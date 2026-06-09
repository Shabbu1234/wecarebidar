import os
import sys
import subprocess
import asyncio
import logging
import requests

# Auto-rerun using Python 3.11 if launched under Python 3.14+ (due to NumPy compatibility crashes on Windows under Python 3.14)
if sys.version_info >= (3, 14):
    if not os.environ.get("WCB_PYTHON_RERUN"):
        os.environ["WCB_PYTHON_RERUN"] = "1"
        try:
            # Re-execute the script using Python 3.11 via the 'py' launcher
            result = subprocess.run(["py", "-3.11"] + sys.argv)
            sys.exit(result.returncode)
        except Exception as err:
            logging.error(f"Failed to auto-rerun script under Python 3.11: {err}")

# Monkeypatch ChatOpenAI.__setattr__ to bypass Pydantic v2 validation errors in browser-use
from langchain_openai import ChatOpenAI
original_setattr = ChatOpenAI.__setattr__
def patched_setattr(self, name, value):
    try:
        original_setattr(self, name, value)
    except ValueError:
        self.__dict__[name] = value
ChatOpenAI.__setattr__ = patched_setattr

# Define a property for provider so that accessing llm.provider doesn't raise AttributeError in Pydantic v2
@property
def provider_prop(self):
    return self.__dict__.get("_provider", "openai")

@provider_prop.setter
def provider_prop(self, value):
    self.__dict__["_provider"] = value

ChatOpenAI.provider = provider_prop

# Load environment variables manually from .env if present
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, val = line.split("=", 1)
                        # Remove quotes if present
                        val = val.strip().strip("'").strip('"')
                        os.environ[key.strip()] = val

load_env()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Environment Configuration
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
PIXELDRAIN_API_KEY = os.environ.get("PIXELDRAIN_API_KEY")

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
    
    from langchain_openai import ChatOpenAI
    from browser_use import Agent

    # Initialize the LLM using NVIDIA's or OpenAI's API depending on key availability
    if NVIDIA_API_KEY and NVIDIA_API_KEY != "your_nvidia_api_key_here":
        logger.info("Initializing LLM using NVIDIA's API endpoint...")
        llm = ChatOpenAI(
            model="meta/llama-3.1-70b-instruct",
            openai_api_key=NVIDIA_API_KEY,
            base_url="https://integrate.api.nvidia.com/v1"
        )
    elif OPENAI_API_KEY:
        logger.info("Initializing LLM using OpenAI's API endpoint...")
        llm = ChatOpenAI(
            model="gpt-4o",
            openai_api_key=OPENAI_API_KEY
        )
    else:
        logger.error("No valid NVIDIA_API_KEY or OPENAI_API_KEY found in environment. Cannot initialize AI agent.")
        raise ValueError("AI API key missing")
    
    # Set provider attribute dynamically for browser-use SDK compatibility
    llm.provider = "openai"
    
    # Initialize the Browser config dynamically
    is_github_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    from browser_use import Agent, Browser

    if is_github_actions:
        logger.info("Running on GitHub Actions. Launching clean headless browser...")
        browser = Browser(headless=True)
    else:
        # Local execution: use user's persistent Google Chrome context so they are logged in
        logger.info("Running locally. Launching persistent Google Chrome context...")
        user_data_dir = r"C:\Users\PC\AppData\Local\Google\Chrome\User Data"
        chrome_path = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        
        # Verify if paths exist, otherwise fallback to default browser
        if os.path.exists(user_data_dir) and os.path.exists(chrome_path):
            try:
                browser = Browser(
                    user_data_dir=user_data_dir,
                    executable_path=chrome_path,
                    headless=False,
                    args=["--start-maximized"],
                    no_viewport=True
                )
            except Exception as e:
                logger.error(f"Failed to launch Chrome with persistent user data: {e}")
                logger.warning("CRITICAL: Google Chrome is likely running and locking your user profile directory.")
                logger.warning("To use auto-login, please close all Google Chrome windows and run this script again.")
                logger.warning("Falling back to a clean headful browser context for this run...")
                browser = Browser(headless=False)
        else:
            logger.warning("Local Chrome or user profile path not found. Falling back to default headful browser...")
            browser = Browser(headless=False)

    # Initialize the browser-use agent
    agent = Agent(
        task=task_prompt,
        llm=llm,
        browser=browser,
        directly_open_url=False
    )
    
    # Run the agent
    logger.info("Starting browser-use agent for social publishing...")
    result = await agent.run()
    logger.info(f"Agent finished execution: {result}")

    # Check if the agent finished successfully
    if not result.is_successful():
        err_msg = ""
        if hasattr(result, 'errors') and result.errors():
            err_msg = f" Errors: {result.errors()}"
        raise RuntimeError(f"Browser-use agent failed to publish the video successfully.{err_msg}")

def delete_cloudinary_video(public_id: str, cloud_name: str, api_key: str, api_secret: str):
    import time
    import hashlib
    
    if not public_id or not cloud_name or not api_key or not api_secret:
        logger.warning("Missing Cloudinary credentials or public_id. Cannot delete video.")
        return None
        
    timestamp = str(int(time.time()))
    # String to sign: alphabetical sorting of parameters
    params = f"public_id={public_id}&timestamp={timestamp}"
    to_sign = params + api_secret
    signature = hashlib.sha1(to_sign.encode('utf-8')).hexdigest()
    
    url = f"https://api.cloudinary.com/v1_1/{cloud_name}/video/destroy"
    payload = {
        "public_id": public_id,
        "timestamp": timestamp,
        "api_key": api_key,
        "signature": signature
    }
    
    try:
        response = requests.post(url, data=payload, timeout=30)
        res_json = response.json()
        logger.info(f"Cloudinary destroy response: {res_json}")
        return res_json
    except Exception as err:
        logger.error(f"Error calling Cloudinary destroy API: {err}")
        return None

def delete_pixeldrain_file(file_id: str, api_key: str = None):
    if not file_id:
        return None
    url = f"https://pixeldrain.net/api/file/{file_id}"
    try:
        if api_key:
            response = requests.delete(url, auth=('', api_key), timeout=30)
            logger.info(f"Pixeldrain delete response: {response.status_code}")
            return response.status_code
        else:
            logger.info(f"No Pixeldrain API Key configured. File {file_id} will be auto-deleted by Pixeldrain after 30 days.")
            return None
    except Exception as e:
        logger.error(f"Error calling Pixeldrain delete API for {file_id}: {e}")
        return None

def fetch_submissions():
    url = "https://firestore.googleapis.com/v1/projects/wecarebidar-79a83/databases/(default)/documents/submissions"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            logger.error(f"Error fetching submissions from Firestore: {r.status_code} - {r.text}")
            return []
        data = r.json()
        documents = data.get("documents", [])
        
        submissions = []
        for doc in documents:
            name = doc.get("name")
            if not name:
                continue
            doc_id = name.split("/")[-1]
            fields = doc.get("fields", {})
            
            def get_val(field_name):
                f = fields.get(field_name, {})
                if "stringValue" in f:
                    return f["stringValue"]
                return None
                
            status = get_val("status")
            video_url = get_val("video_url")
            
            if video_url and status in ["approved", "rejected", "rejected_delete"]:
                submissions.append({
                    "id": doc_id,
                    "title": get_val("title") or "Environmental Action",
                    "user_description": get_val("user_description") or "",
                    "video_url": video_url,
                    "status": status,
                    "pixeldrain_file_id": get_val("pixeldrain_file_id"),
                    "cloudinary_public_id": get_val("cloudinary_public_id")
                })
        return submissions
    except Exception as e:
        logger.error(f"Exception during Firestore fetching: {e}")
        return []

def clear_video_fields(doc_id):
    url = f"https://firestore.googleapis.com/v1/projects/wecarebidar-79a83/databases/(default)/documents/submissions/{doc_id}"
    params = [
        ("updateMask.fieldPaths", "video_url"),
        ("updateMask.fieldPaths", "cloudinary_public_id"),
        ("updateMask.fieldPaths", "pixeldrain_file_id")
    ]
    payload = {
        "fields": {
            "video_url": { "nullValue": None },
            "cloudinary_public_id": { "nullValue": None },
            "pixeldrain_file_id": { "nullValue": None }
        }
    }
    try:
        r = requests.patch(url, params=params, json=payload, timeout=30)
        if r.status_code == 200:
            logger.info(f"Successfully cleared video fields for submission {doc_id}.")
            return True
        else:
            logger.error(f"Failed to clear video fields for submission {doc_id}: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        logger.error(f"Exception updating Firestore for {doc_id}: {e}")
        return False

def delete_submission_doc(doc_id):
    url = f"https://firestore.googleapis.com/v1/projects/wecarebidar-79a83/databases/(default)/documents/submissions/{doc_id}"
    try:
        r = requests.delete(url, timeout=30)
        if r.status_code == 200:
            logger.info(f"Successfully deleted submission document {doc_id} from database.")
            return True
        else:
            logger.error(f"Failed to delete submission document {doc_id} from database: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        logger.error(f"Exception deleting Firestore doc {doc_id}: {e}")
        return False

async def main():
    # Fetch submissions pending publishing/purging
    submissions = fetch_submissions()
    
    if not submissions:
        logger.info("No pending videos for publish or purge.")
        return
        
    for sub in submissions:
        video_url = sub.get("video_url")
        sub_id = sub.get("id")
        title = sub.get("title", "Environmental Action")
        desc = sub.get("user_description", "")
        status = sub.get("status")
        
        logger.info(f"Processing submission {sub_id} with status '{status}'...")

        # If rejected or rejected_delete, perform instant zero-residue cleanup and continue
        if status in ["rejected", "rejected_delete"]:
            try:
                pixeldrain_file_id = sub.get("pixeldrain_file_id")
                cloudinary_public_id = sub.get("cloudinary_public_id")
                
                is_cloudinary = video_url and "cloudinary.com" in video_url
                if is_cloudinary:
                    if cloudinary_public_id:
                        logger.info(f"Purging video from Cloudinary: {cloudinary_public_id}...")
                        delete_cloudinary_video(cloudinary_public_id, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
                else:
                    if pixeldrain_file_id:
                        logger.info(f"Purging video from Pixeldrain: {pixeldrain_file_id}...")
                        delete_pixeldrain_file(pixeldrain_file_id, PIXELDRAIN_API_KEY)

                if status == "rejected_delete":
                    logger.info(f"Deleting submission document {sub_id} from database...")
                    delete_submission_doc(sub_id)
                else:
                    logger.info(f"Clearing video fields in rejected submission {sub_id}...")
                    clear_video_fields(sub_id)
                logger.info(f"Successfully cleaned up rejected/deleted submission {sub_id}.")
            except Exception as e:
                logger.error(f"Error purging rejected/deleted submission {sub_id}: {e}")
            continue
        
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
            logger.info(f"Downloading video from {video_url} to {local_path}...")
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
            try:
                await publish_video(local_path, title, desc)
            except Exception as publish_err:
                logger.error(f"Failed to publish video via browser-use: {publish_err}")
                # We do not proceed with cleanup if publishing fails, to prevent loss of data
                continue
            
            # 4. Zero-Residue: Cleanup Pixeldrain or Cloudinary
            pixeldrain_file_id = sub.get("pixeldrain_file_id")
            cloudinary_public_id = sub.get("cloudinary_public_id")
            
            is_cloudinary = video_url and "cloudinary.com" in video_url
            if is_cloudinary:
                if cloudinary_public_id:
                    logger.info(f"Purging video from Cloudinary: {cloudinary_public_id}...")
                    delete_cloudinary_video(cloudinary_public_id, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
            else:
                if pixeldrain_file_id:
                    logger.info(f"Purging video from Pixeldrain: {pixeldrain_file_id}...")
                    delete_pixeldrain_file(pixeldrain_file_id, PIXELDRAIN_API_KEY)
            
            # 5. Zero-Residue: Clear video fields in database
            logger.info("Clearing video fields in database to finalize zero-residue footprint...")
            clear_video_fields(sub_id)
            
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
