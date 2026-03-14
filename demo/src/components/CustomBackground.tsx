import React from "react";
import spaceImg from "../../assets/space.jpg";

export function CustomBackground(): React.ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundImage: `url(${spaceImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );
}

export default CustomBackground;
