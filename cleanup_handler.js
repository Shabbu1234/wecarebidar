// =======================================================
// WeCareBidar - AUTOMATIC STORAGE PURGE LOGIC
// =======================================================
// This script runs inside the AntGvity (Activepieces Core) 
// code execution block immediately following social distribution.
//
// Required npm dependencies for the Activepieces code step:
// { "@supabase/supabase-js": "^2.39.0" }

const { createClient } = require('@supabase/supabase-js');

exports.code = async (inputs) => {
  const { videoId, bucketFileName, supabaseUrl, supabaseServiceRoleKey } = inputs;

  // 1. Inputs validation
  if (!videoId || !bucketFileName) {
    return {
      success: false,
      error: "Missing required arguments: videoId and bucketFileName must be provided.",
      logs: []
    };
  }

  if (!supabaseUrl || !supabaseServiceRoleKey || 
      supabaseUrl === "YOUR_SUPABASE_URL" || 
      supabaseServiceRoleKey === "YOUR_SUPABASE_SERVICE_ROLE_KEY") {
    return {
      success: false,
      error: "Configuration Error: Supabase credentials are not configured in the workflow inputs.",
      logs: []
    };
  }

  const logs = [];
  logs.push(`Initiating storage cleanup for Submissions Asset ID: ${videoId}`);
  logs.push(`Target Storage Object Name: ${bucketFileName}`);

  try {
    // 2. Initialize Supabase Client with Service Role Key (bypasses Row-Level Security)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Delete binary file from storage bucket
    logs.push("Requesting deletion of video binary from 'temporary-videos' bucket...");
    const { data: storageData, error: storageError } = await supabase.storage
      .from('temporary-videos')
      .remove([bucketFileName]);

    if (storageError) {
      logs.push(`Storage deletion failed: ${storageError.message}`);
      throw new Error(`Storage error: ${storageError.message}`);
    }
    
    logs.push(`Storage binary successfully removed from 'temporary-videos'. Response: ${JSON.stringify(storageData)}`);

    // 4. Update submissions database row: wipe the temporary URL and change status to 'approved'
    logs.push("Updating database submission record: clearing video_url and setting status = 'approved'...");
    const { data: dbData, error: dbError } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        video_url: null // Crucial: Hard deletes URL string reference to save DB space
      })
      .eq('id', videoId)
      .select();

    if (dbError) {
      logs.push(`Database update failed: ${dbError.message}`);
      throw new Error(`Database error: ${dbError.message}`);
    }

    logs.push("Database record successfully updated. Storage reset to 0MB for this asset.");

    return {
      success: true,
      logs: logs,
      summary: `Cloud Cleaned: "WeCareBidar" storage reset to 0MB for Asset ${videoId}`,
      purgedAsset: bucketFileName,
      updatedRecord: dbData
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
