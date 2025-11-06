import React, { useState, useCallback } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { FaArrowLeft } from "react-icons/fa";

const ImageCropper = ({ image, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imgRef, setImgRef] = useState(null);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 3 / 4, width, height), width, height));
  }, []);

  const getCroppedImg = () => {
    if (!completedCrop || !imgRef) return;

    const canvas = document.createElement("canvas");
    const scaleX = imgRef.naturalWidth / imgRef.width;
    const scaleY = imgRef.naturalHeight / imgRef.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      imgRef,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const fileUrl = URL.createObjectURL(blob);
        resolve(fileUrl);
      }, "image/jpeg");
    });
  };

  const handleDone = async () => {
    const croppedUrl = await getCroppedImg();
    onCropComplete(croppedUrl);
  };

  return (
    <div className="scan-crop-container">
      {/* Blue Header */}
      {/* <div className="scan-header">
        <FaArrowLeft className="back-icon" onClick={onCancel} />
        <h3>Scan Aadhar Card</h3>
      </div> */}

      {/* Crop Area */}
      <div className="scan-crop-area">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          keepSelection
        >
          <img ref={setImgRef} src={image} alt="Crop target" onLoad={onImageLoad} />
        </ReactCrop>
      </div>

      {/* Bottom Buttons */}
      <div className="scan-buttons">
        <button className="done" onClick={handleDone}>Done</button>
        <button className="cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default ImageCropper;
