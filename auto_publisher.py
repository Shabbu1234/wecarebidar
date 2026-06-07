import os
import asyncio
import logging
import requests
import firebase_admin
from firebase_admin import credentials, firestore, storage
from browser_use import Agent
from langchain_openai import ChatOpenAI

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Environment Configuration
FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
FIREBASE_STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")

async def publish_video(video_path: str, title: str, description: str):
    """
    Uses the browser-use AI agent to navigate to social platforms and upload the video.
    """
    task_prompt = f"""
    You are an automated social media manager for 'WeCareBidar', an environmental revolution movement.
    Your task is to upload the video located at absolute path: {video_path} 
    to our social media channels (e.g., YouTube Shorts, Instagram Reels).
    
    Campaign Title: {title}
    Description/Notes: {description}
    
    Please navigate to the platforms, log in if necessary (using saved session state if available), 
    upload the video file using the file upload inputs, add the title and description, and publish it.
    """
    
    # Initialize the LLM using NVIDIA's OpenAI-compatible API
    # Model: meta/llama-3.1-70b-instruct is excellent for reasoning and automation
    llm = ChatOpenAI(
        model="meta/llama-3.1-70b-instruct",
        openai_api_key=NVIDIA_API_KEY,
        base_url="https://integrate.api.nvidia.com/v1"
    )
    
    # Initialize the browser-use agent
    agent = Agent(
        task=task_prompt,
        llm=llm,
    )
    
    # Run the agent
    logger.info("Starting browser-use agent for social publishing...")
    result = await agent.run()
    logger.info(f"Agent finished execution: {result}")

async def main():
    if not FIREBASE_SERVICE_ACCOUNT_JSON:
        logger.error("FIREBASE_SERVICE_ACCOUNT_JSON not found in environment.")
        return

    # Initialize firebase-admin if not already initialized
    if not firebase_admin._apps:
        import json
        try:
            service_account_info = json.loads(FIREBASE_SERVICE_ACCOUNT_JSON)
            cred = credentials.Certificate(service_account_info)
        except json.JSONDecodeError:
            cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_JSON)
        
        firebase_admin.initialize_app(cred, {
            'storageBucket': FIREBASE_STORAGE_BUCKET
        })

    db = firestore.client()
    bucket = storage.bucket()

    # 1. Fetch approved submissions that haven't been purged yet
    submissions_ref = db.collection("submissions").where("status", "==", "approved").stream()
    
    submissions = []
    for doc in submissions_ref:
        data = doc.to_dict()
        data["id"] = doc.id
        if data.get("video_url"):
            submissions.append(data)

    if not submissions:
        logger.info("No new approved videos pending for publish.")
        return
        
    for sub in submissions:
        video_url = sub.get("video_url")
        sub_id = sub.get("id")
        title = sub.get("title", "Environmental Action")
        desc = sub.get("user_description", "")
        
        logger.info(f"Processing approved submission {sub_id}...")
        
        # Extract filename
        import urllib.parse
        decoded_url = urllib.parse.unquote(video_url)
        if '/temporary-videos/' in decoded_url:
            filename = decoded_url.split('/temporary-videos/')[-1].split('?')[0]
        elif 'temporary-videos/' in decoded_url:
            filename = decoded_url.split('temporary-videos/')[-1].split('?')[0]
        else:
            filename = decoded_url.split('/')[-1].split('?')[0]
            
        local_dir = os.path.abspath("temp_downloads")
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, filename)
        
        # 2. Download the video - Streaming chunked download for large files (up to 2GB)
        try:
            logger.info(f"Downloading video from Firebase to {local_path}...")
            r = requests.get(video_url, stream=True, timeout=300)  # 5 min timeout
            if r.status_code == 200:
                total_size = int(r.headers.get('content-length', 0))
                total_mb = total_size / (1024 * 1024)
                logger.info(f"File size: {total_mb:.1f} MB ({total_size} bytes)")
                
                downloaded = 0
                chunk_size = 8 * 1024 * 1024  # 8MB chunks for fast download
                with open(local_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total_size > 0:
                                pct = (downloaded / total_size) * 100
                                if downloaded % (50 * 1024 * 1024) < chunk_size:  # Log every 50MB
                                    logger.info(f"Download progress: {pct:.1f}% ({downloaded/(1024*1024):.1f} MB)")
                logger.info(f"Download complete: {downloaded/(1024*1024):.1f} MB downloaded")
            else:
                logger.error(f"Failed to download video: HTTP {r.status_code}")
                continue
                
            # 3. Publish to social media
            await publish_video(local_path, title, desc)
            
            # 4. Zero-Residue: Cleanup Firebase Storage
            logger.info(f"Purging video {filename} from Firebase storage (temporary-videos)...")
            blob = bucket.blob(f"temporary-videos/{filename}")
            if blob.exists():
                blob.delete()
                logger.info(f"Successfully deleted temporary-videos/{filename} from storage.")
            else:
                logger.warning(f"Blob temporary-videos/{filename} not found in storage bucket.")
            
            # 5. Zero-Residue: Clear video_url in database
            logger.info("Clearing video_url in database to finalize zero-residue footprint...")
            db.collection("submissions").document(sub_id).update({"video_url": None})
            
            logger.info(f"Successfully processed and purged submission {sub_id}.")
            
        except Exception as e:
            logger.error(f"Error processing submission {sub_id}: {e}")
        finally:
            # Clean up local temporary file
            if os.path.exists(local_path):
                os.remove(local_path)
                logger.info(f"Deleted local temporary file {local_path}")

if __name__ == "__main__":
    asyncio.run(main())
