(function () {
    // Splash screen base directory
    const base = 'assets/splash/';
  
    // Device specifications and image configurations
    const devices = [
      { w: 440, h: 956, r: 3, img: 'iPhone_17_Pro_Max__iPhone_16_Pro_Max' },
      { w: 402, h: 874, r: 3, img: 'iPhone_17_Pro__iPhone_17__iPhone_16_Pro' },
      { w: 430, h: 932, r: 3, img: 'iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max' },
      { w: 420, h: 912, r: 3, img: 'iPhone_Air' },
      { w: 393, h: 852, r: 3, img: 'iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro' },
      { w: 428, h: 926, r: 3, img: 'iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max' },
      { w: 390, h: 844, r: 3, img: 'iPhone_17e__iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12' },
      { w: 375, h: 812, r: 3, img: 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X' },
      { w: 414, h: 896, r: 3, img: 'iPhone_11_Pro_Max__iPhone_XS_Max' },
      { w: 414, h: 896, r: 2, img: 'iPhone_11__iPhone_XR' },
      { w: 414, h: 736, r: 3, img: 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus' },
      { w: 375, h: 667, r: 2, img: 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE' },
      { w: 320, h: 568, r: 2, img: '4__iPhone_SE__iPod_touch_5th_generation_and_later' },
      { w: 1032, h: 1376, r: 2, img: '13__iPad_Pro_M4' },
      { w: 1024, h: 1366, r: 2, img: '12.9__iPad_Pro' },
      { w: 834, h: 1210, r: 2, img: '11__iPad_Pro_M4' },
      { w: 834, h: 1194, r: 2, img: '11__iPad_Pro__10.5__iPad_Pro' },
      { w: 820, h: 1180, r: 2, img: '10.9__iPad_Air' },
      { w: 834, h: 1112, r: 2, img: '10.5__iPad_Air' },
      { w: 810, h: 1080, r: 2, img: '10.2__iPad' },
      { w: 768, h: 1024, r: 2, img: '9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad' },
      { w: 744, h: 1133, r: 2, img: '8.3__iPad_Mini' }
    ];
  
    // Generate and inject link elements into head
    const fragment = document.createDocumentFragment();
  
    devices.forEach(device => {
      ['landscape', 'portrait'].forEach(orientation => {
        const link = document.createElement('link');
        link.rel = 'apple-touch-startup-image';
        link.media = `screen and (device-width: ${device.w}px) and (device-height: ${device.h}px) and (-webkit-device-pixel-ratio: ${device.r}) and (orientation: ${orientation})`;
        link.href = `${base}${device.img}_${orientation}.png`;
        fragment.appendChild(link);
      });
    });
  
    document.head.appendChild(fragment);
  })();