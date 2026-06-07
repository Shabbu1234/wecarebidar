import os
import asyncio
import logging
import requests
from supabase import create_client, Client
from browser_use import Agent
from langchain_openai import ChatOpenAI

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Environment Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
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
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Supabase credentials not found in environment.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Fetch approved submissions that haven't been purged yet
    # We look for status='approved' where video_url is still present.
    response = supabase.table("submissions").select("*").eq("status", "approved").not_is("video_url", "null").execute()
    
    submissions = response.data
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
        filename = video_url.split('/temporary-videos/')[-1] if '/temporary-videos/' in video_url else video_url.split('/')[-1]
        local_dir = os.path.abspath("temp_downloads")
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, filename)
        
        # 2. Download the video
        try:
            logger.info(f"Downloading video from Supabase to {local_path}...")
            r = requests.get(video_url, stream=True)
            if r.status_code == 200:
                with open(local_path, 'wb') as f:
                    for chunk in r.iter_content(1024):
                        f.write(chunk)
            else:
                logger.error(f"Failed to download video: HTTP {r.status_code}")
                continue
                
            # 3. Publish to social media
            await publish_video(local_path, title, desc)
            
            # 4. Zero-Residue: Cleanup Supabase Storage
            logger.info(f"Purging video {filename} from Supabase storage (temporary-videos)...")
            res = supabase.storage.from_("temporary-videos").remove([filename])
            logger.info(f"Storage purge response: {res}")
            
            # 5. Zero-Residue: Clear video_url in database
            logger.info("Clearing video_url in database to finalize zero-residue footprint...")
            supabase.table("submissions").update({"video_url": None}).eq("id", sub_id).execute()
            
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
