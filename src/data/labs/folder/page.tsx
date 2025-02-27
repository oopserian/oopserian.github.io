import './style.css';
import temp_image_1 from "./assets/temp-01.webp";
import temp_image_2 from "./assets/temp-02.webp";
import temp_image_3 from "./assets/temp-03.webp";
import { IconPhotoScan } from '@tabler/icons-react';

export default function Folder() {
    return (
        <div className='folder-wrap'>
            <div className="folder" style={{
                width: '8rem'
            }}>
                <div className="folder-behind">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 332 256" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
                        <rect fill="currentColor" x="0" y="0" width="100%" height="100%" clipPath="url(#folder-path)" />
                        <defs>
                            <clipPath id="folder-path">
                                <path
                                    d="M22,0 H100 C122,0 122,22 144,22 H310 A22,22 0 0 1 332,44 V234 A22,22 0 0 1 310,256 H22 A22,22 0 0 1 0,234 V22 A22,22 0 0 1 22,0"
                                ></path>
                            </clipPath>
                        </defs>
                    </svg>
                </div>
                <div className="folder-content">
                    <img src={temp_image_1} />
                    <img src={temp_image_2} />
                    <img src={temp_image_3} />
                </div>
                <div className="folder-front">
                    <div className="folder-logo">
                        <IconPhotoScan />
                    </div>
                </div>
            </div>
            <p className="tip">Hover 👆</p>
        </div>
    )
}