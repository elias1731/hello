/* iOS PWA splash screens */
const screens = [
    { w: 414, h: 896, r: 2, o: 'portrait', f: 'iPhone_11__iPhone_XR_portrait.png' },
    { w: 414, h: 896, r: 3, o: 'landscape', f: 'iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png' },
    { w: 810, h: 1080, r: 2, o: 'landscape', f: '10.2__iPad_landscape.png' },
    { w: 420, h: 912, r: 3, o: 'landscape', f: 'iPhone_Air_landscape.png' },
    { w: 414, h: 736, r: 3, o: 'landscape', f: 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png' },
    { w: 430, h: 932, r: 3, o: 'landscape', f: 'iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png' },
    { w: 768, h: 1024, r: 2, o: 'landscape', f: '9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png' },
    { w: 440, h: 956, r: 3, o: 'portrait', f: 'iPhone_17_Pro_Max__iPhone_16_Pro_Max_portrait.png' },
    { w: 430, h: 932, r: 3, o: 'portrait', f: 'iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png' },
    { w: 414, h: 736, r: 3, o: 'portrait', f: 'iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png' },
    { w: 1032, h: 1376, r: 2, o: 'portrait', f: '13__iPad_Pro_M4_portrait.png' },
    { w: 320, h: 568, r: 2, o: 'portrait', f: '4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png' },
    { w: 820, h: 1180, r: 2, o: 'portrait', f: '10.9__iPad_Air_portrait.png' },
    { w: 414, h: 896, r: 3, o: 'portrait', f: 'iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png' },
    { w: 834, h: 1194, r: 2, o: 'portrait', f: '11__iPad_Pro__10.5__iPad_Pro_portrait.png' },
    { w: 834, h: 1194, r: 2, o: 'landscape', f: '11__iPad_Pro__10.5__iPad_Pro_landscape.png' },
    { w: 834, h: 1112, r: 2, o: 'landscape', f: '10.5__iPad_Air_landscape.png' },
    { w: 834, h: 1112, r: 2, o: 'portrait', f: '10.5__iPad_Air_portrait.png' },
    { w: 1032, h: 1376, r: 2, o: 'landscape', f: '13__iPad_Pro_M4_landscape.png' },
    { w: 375, h: 667, r: 2, o: 'portrait', f: 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png' },
    { w: 428, h: 926, r: 3, o: 'landscape', f: 'iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape.png' },
    { w: 1024, h: 1366, r: 2, o: 'portrait', f: '12.9__iPad_Pro_portrait.png' },
    { w: 375, h: 812, r: 3, o: 'landscape', f: 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png' },
    { w: 320, h: 568, r: 2, o: 'landscape', f: '4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png' },
    { w: 420, h: 912, r: 3, o: 'portrait', f: 'iPhone_Air_portrait.png' },
    { w: 375, h: 812, r: 3, o: 'portrait', f: 'iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png' },
    { w: 820, h: 1180, r: 2, o: 'landscape', f: '10.9__iPad_Air_landscape.png' },
    { w: 744, h: 1133, r: 2, o: 'landscape', f: '8.3__iPad_Mini_landscape.png' },
    { w: 428, h: 926, r: 3, o: 'portrait', f: 'iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png' },
    { w: 393, h: 852, r: 3, o: 'portrait', f: 'iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png' },
    { w: 393, h: 852, r: 3, o: 'landscape', f: 'iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png' },
    { w: 390, h: 844, r: 3, o: 'portrait', f: 'iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png' },
    { w: 834, h: 1210, r: 2, o: 'portrait', f: '11__iPad_Pro_M4_portrait.png' },
    { w: 768, h: 1024, r: 2, o: 'portrait', f: '9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png' },
    { w: 1024, h: 1366, r: 2, o: 'landscape', f: '12.9__iPad_Pro_landscape.png' },
    { w: 744, h: 1133, r: 2, o: 'portrait', f: '8.3__iPad_Mini_portrait.png' },
    { w: 375, h: 667, r: 2, o: 'landscape', f: 'iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png' },
    { w: 390, h: 844, r: 3, o: 'landscape', f: 'iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png' },
    { w: 402, h: 874, r: 3, o: 'landscape', f: 'iPhone_17_Pro__iPhone_17__iPhone_16_Pro_landscape.png' },
    { w: 834, h: 1210, r: 2, o: 'landscape', f: '11__iPad_Pro_M4_landscape.png' },
    { w: 402, h: 874, r: 3, o: 'portrait', f: 'iPhone_17_Pro__iPhone_17__iPhone_16_Pro_portrait.png' },
    { w: 414, h: 896, r: 2, o: 'landscape', f: 'iPhone_11__iPhone_XR_landscape.png' },
    { w: 440, h: 956, r: 3, o: 'landscape', f: 'iPhone_17_Pro_Max__iPhone_16_Pro_Max_landscape.png' },
    { w: 810, h: 1080, r: 2, o: 'portrait', f: '10.2__iPad_portrait.png' }
];

/* logic to inject tags into the document head */
screens.forEach(s => {
    const link = document.createElement('link');
    link.rel = 'apple-touch-startup-image';
    link.media = `screen and (device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: ${s.o})`;
    link.href = `./assets/${s.f}`;
    document.head.appendChild(link);
});
