"use client"

import React from 'react';
import Image from 'next/image';
type ImageProps = {
  imageUrl1: string;
  imageUrl2: string;
}

const TickerLogo: React.FC<ImageProps> = ({ imageUrl1, imageUrl2 }) => {
  return (
    <div className="flex justify-center space-x-1 p-2">
      <Image 
        src={imageUrl1 && imageUrl1} 
        width={30}
        height={30}
        alt="logo1" 
        className="absolute rounded-full w-8 h-8 z-20 ml-6" 
        priority={true}
        loading='eager'

      />
      <Image 
        src={imageUrl2 && imageUrl2} 
        width={30}
        height={30}
        alt="logo2" 
        className="absolute rounded-full w-8 h-8 z-10 -ml-2" 
        priority={true}
        loading='eager'
      />
    </div>
  );
}

export default TickerLogo;
