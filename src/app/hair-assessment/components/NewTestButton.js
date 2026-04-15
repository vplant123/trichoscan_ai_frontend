import React from "react";
import "./NewTestButton.css";

const NewTestButton = ({ onClick }) => {
  return (
    <button className="premium-new-test-btn" onClick={onClick}>
      <span className="btn-text">TAKE A NEW HAIR TEST</span>
      <span className="btn-shine"></span>
    </button>
  );
};

export default NewTestButton;
