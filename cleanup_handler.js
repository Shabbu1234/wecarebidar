// =======================================================
// WeCareBidar - AUTOMATIC CLOUDINARY & FIREBASE PURGE LOGIC
// =======================================================
// This script runs inside the AntGvity (Activepieces Core) 
// code execution block immediately following social distribution.
//
// Zero-dependency Node.js code block.

const crypto = require('crypto');

exports.code = async (inputs) => {
  const { 
    videoId, 
    cloudinaryPublicId, 
    cloudinaryCloudName = 'dqm62mqbs', 
    cloudinaryApiKey = '974397986324117', 
    cloudinaryApiSecret = 'Rd2WKWOORE7mcTcqjvuxmNpcNv0',
    firebaseProjectId = 'wecarebidar-79a83'
  } = inputs;

  // 1. Inputs validation
  if (!videoId) {
    return {
      success: false,
      error: "Missing required argument: videoId (Firestore document ID) must be provided.",
      logs: []
    };
  }

  const logs = [];
  logs.push(`Initiating storage cleanup for Submissions Asset ID: ${videoId}`);
  logs.push(`Cloudinary Public ID: ${cloudinaryPublicId}`);

  try {
    // 2. Delete video from Cloudinary
    if (cloudinaryPublicId && cloudinaryApiSecret && cloudinaryCloudName && cloudinaryApiKey) {
      logs.push("Requesting deletion of video binary from Cloudinary...");
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Generate SHA-1 signature: alphabetical sorting of parameters
      const signatureStr = `public_id=${cloudinaryPublicId}&timestamp=${timestamp}${cloudinaryApiSecret}`;
      const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/destroy`;
      
      const formData = new URLSearchParams();
      formData.append('public_id', cloudinaryPublicId);
      formData.append('timestamp', timestamp);
      formData.append('api_key', cloudinaryApiKey);
      formData.append('signature', signature);

      const cloudResp = await fetch(cloudinaryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const cloudData = await cloudResp.json();
      logs.push(`Cloudinary response: ${JSON.stringify(cloudData)}`);
      
      if (cloudData.result !== 'ok' && cloudData.result !== 'not found') {
        logs.push(`Cloudinary warning: destroy response was ${cloudData.result}`);
      }
    } else {
      logs.push("Skipping Cloudinary deletion: missing public ID or configuration.");
    }

    // 3. Update Firestore database document: clear video fields to maintain 0MB footprint
    logs.push("Updating Firestore database submission record: clearing video fields...");
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/submissions/${videoId}?updateMask.fieldPaths=video_url&updateMask.fieldPaths=cloudinary_public_id&updateMask.fieldPaths=pixeldrain_file_id`;

    const dbResp = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          video_url: { nullValue: null },
          cloudinary_public_id: { nullValue: null },
          pixeldrain_file_id: { nullValue: null }
        }
      })
    });

    if (!dbResp.ok) {
      const dbErrText = await dbResp.text();
      logs.push(`Firestore update failed: ${dbResp.status} - ${dbErrText}`);
      throw new Error(`Firestore error: ${dbResp.status}`);
    }

    logs.push("Firestore record successfully updated. Storage reset to 0MB for this asset.");

    return {
      success: true,
      logs: logs,
      summary: `Cloud Cleaned: "WeCareBidar" storage reset to 0MB for Asset ${videoId}`,
      purgedAsset: cloudinaryPublicId
    };

  } catch (error) {
    console.error("Cleanup Execution failed:", error);
    return {
      success: false,
      error: error.message,
      logs: logs
    };
  }
};
