const axios = require("axios");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

module.exports = async function saveImageFromUrl(url) {
  try {
    const conn = mongoose.connection;

    // ✅ IMPORTANT: use SAME bucket as uploadProfileImage & getProfileImage
    const bucket = new GridFSBucket(conn.db, {
      bucketName: "driver_docs"
    });

    const response = await axios({
      url,
      method: "GET",
      responseType: "arraybuffer"
    });

    const contentType = response.headers["content-type"] || "image/jpeg";

    const uploadStream = bucket.openUploadStream("google-photo", {
      metadata: {
        mimetype: contentType,
        docType: "profile",
        uploadDate: new Date()
      }
    });

    uploadStream.end(response.data);

    return new Promise((resolve, reject) => {
      uploadStream.on("finish", () => resolve(uploadStream.id));
      uploadStream.on("error", reject);
    });

  } catch (error) {
    console.error("❌ Error saving Google image:", error);
    return null;
  }
};
