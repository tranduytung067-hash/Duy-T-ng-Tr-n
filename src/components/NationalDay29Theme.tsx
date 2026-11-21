import React, { useState, useEffect } from 'react';
import { Sparkles, Flag, Star, ShieldCheck } from 'lucide-react';

interface NationalDay29ThemeProps {
  enabled: boolean;
  opacity?: number; // 0.1 to 1.0
  onToggle?: () => void;
}

export const NationalDay29HeaderBanner: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  if (!enabled) return null;

  return (
    <div className="hidden md:block relative overflow-hidden bg-gradient-to-r from-red-950 via-red-750 to-red-950 text-amber-200 border-b-2 border-amber-400/80 shadow-xl py-2 px-3 sm:px-6 select-none z-40">
      {/* Background glowing star animation */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent animate-pulse pointer-events-none" />
      
      {/* Left/Right gold ribbon accents */}
      <div className="absolute top-0 left-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-amber-500/20 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-amber-500/20 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 relative z-10 text-center">
        
        {/* Left Badge */}
        <div className="flex items-center gap-2 bg-red-900/90 border border-amber-400/70 px-3 py-1 rounded-full shadow-lg shrink-0">
          <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-amber-300 shadow-xs shrink-0 relative flex items-center justify-center bg-[#DA251D]">
            <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="300" height="200" fill="#DA251D" />
              <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
            </svg>
          </div>
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300">
            QUỐC KHÁNH VIỆT NAM
          </span>
        </div>

        {/* Center Main Text with explicit Line Break right after VIỆT NAM */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-0.5 sm:px-1 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 text-[8.5px] min-[360px]:text-[9.5px] min-[400px]:text-[10.5px] sm:text-sm md:text-base font-black uppercase tracking-tight sm:tracking-wide text-white drop-shadow-md leading-snug w-full">
            <Star className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 sm:w-4 sm:h-4 text-amber-300 fill-amber-300 animate-spin-slow shrink-0" />
            <span className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 bg-clip-text text-transparent whitespace-nowrap">
              CHÀO MỪNG 81 NĂM QUỐC KHÁNH NƯỚC CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </span>
            <Star className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 sm:w-4 sm:h-4 text-amber-300 fill-amber-300 animate-spin-slow shrink-0" />
          </div>
          
          {/* Explicit line break section for dates 02/09/1945 - 02/09/2026 */}
          <div className="mt-1 inline-flex items-center gap-1.5 sm:gap-2 bg-red-950/90 px-2.5 py-0.5 rounded-full border border-amber-400/50 text-amber-300 font-black text-[10px] sm:text-xs tracking-widest shadow-inner">
            <div className="w-4 h-2.5 rounded-xs overflow-hidden border border-amber-300/80 shrink-0 relative flex items-center justify-center bg-[#DA251D]">
              <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="200" fill="#DA251D" />
                <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
              </svg>
            </div>
            <span>02/09/1945 - 02/09/2026</span>
            <div className="w-4 h-2.5 rounded-xs overflow-hidden border border-amber-300/80 shrink-0 relative flex items-center justify-center bg-[#DA251D]">
              <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="300" height="200" fill="#DA251D" />
                <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Badge */}
        <div className="hidden lg:flex items-center gap-2 bg-red-900/90 border border-amber-400/70 px-3 py-1 rounded-full shadow-lg shrink-0">
          <div className="w-5 h-3.5 rounded-xs overflow-hidden border border-amber-300 shadow-xs shrink-0 relative flex items-center justify-center bg-[#DA251D]">
            <svg className="w-full h-full" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="300" height="200" fill="#DA251D" />
              <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
            </svg>
          </div>
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300">
            TỰ HÀO VIỆT NAM
          </span>
        </div>

      </div>
    </div>
  );
};

export const NationalDay29Background: React.FC<NationalDay29ThemeProps> = ({ enabled, opacity = 0.85 }) => {
  if (!enabled) return null;

  return (
    <div 
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500"
      style={{ opacity }}
    >
      {/* 1. Base Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-amber-950/5 to-slate-900/10" />

      {/* 2. Top-Left Floating Vietnam Flag Emblem */}
      <div className="absolute -top-12 -left-12 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-4 left-6 opacity-30 md:opacity-50 flex items-center gap-2 select-none">
        <svg className="w-20 h-14 shadow-2xl rounded" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="200" fill="#DA251D" />
          <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
        </svg>
      </div>

      {/* 3. Top-Right Floating Vietnam Flag Emblem */}
      <div className="absolute -top-12 -right-12 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-4 right-6 opacity-30 md:opacity-50 flex items-center gap-2 select-none">
        <svg className="w-20 h-14 shadow-2xl rounded" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="200" fill="#DA251D" />
          <polygon points="150,40 163,82 207,82 171,108 185,150 150,124 115,150 129,108 93,82 137,82" fill="#FFFF00" />
        </svg>
      </div>

      {/* 4. Center Background Radiant Golden Star Motif */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 md:opacity-15 pointer-events-none">
        <div className="relative w-96 h-96 flex items-center justify-center">
          {/* Glowing Radial Beams */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400/40 via-red-500/30 to-amber-400/40 blur-2xl animate-pulse" />
          
          {/* Center 5-Point Gold Star Vector */}
          <svg className="w-80 h-80 text-amber-400 fill-amber-400 drop-shadow-[0_0_35px_rgba(251,191,36,0.6)]" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      </div>

      {/* 6. Bottom Silhouette / Festive Celebration Waves */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-red-950/20 via-amber-900/5 to-transparent pointer-events-none" />
      
      {/* Decorative Floating Golden Particles */}
      <div className="absolute top-1/3 left-10 w-2 h-2 rounded-full bg-amber-400/50 blur-xs animate-bounce" />
      <div className="absolute top-1/2 right-12 w-3 h-3 rounded-full bg-red-400/40 blur-xs animate-ping" />
      <div className="absolute bottom-1/4 left-1/4 w-2.5 h-2.5 rounded-full bg-yellow-300/50 blur-xs animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-2 h-2 rounded-full bg-amber-300/60 blur-xs animate-bounce" />
    </div>
  );
};

export default NationalDay29Background;

export const BaDinhSquareIllustration: React.FC<{ 
  enabled?: boolean; 
  opacity?: number;
  customImageUrl?: string;
}> = ({ 
  enabled = true, 
  opacity = 0.85,
  customImageUrl
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [customImageUrl]);

  if (!enabled) return null;

  // Render custom image directly if provided
  const hasCustomImg = Boolean(customImageUrl && customImageUrl.trim().length > 0);
  const showCustomImg = hasCustomImg && !imgError;

  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none overflow-hidden transition-opacity duration-500 z-0"
      style={{ opacity }}
    >
      {showCustomImg ? (
        <img 
          src={customImageUrl} 
          alt="Tuyên Ngôn Độc Lập - Chủ Tịch Hồ Chí Minh" 
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <svg 
          className="w-full h-full object-cover" 
          viewBox="0 0 1000 500" 
          preserveAspectRatio="xMidYMid slice"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Red Flag Background Gradient */}
            <linearGradient id="redFlagBg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#DC2626" />
              <stop offset="50%" stopColor="#E11D48" />
              <stop offset="80%" stopColor="#B91C1C" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>

            {/* Aged Parchment Paper Texture Gradient */}
            <linearGradient id="parchmentBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="40%" stopColor="#FDE047" />
              <stop offset="85%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>

            {/* Vintage Paper Shadow */}
            <filter id="dropShadowParchment" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="4" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* 1. Left Red Flag Canvas */}
          <rect width="600" height="500" fill="url(#redFlagBg)" />
          
          {/* Yellow Star on Red Flag */}
          <polygon points="500,100 508,125 535,125 513,140 522,165 500,150 478,165 487,140 465,125 492,125" fill="#FFFF00" />

          {/* 2. Right Parchment Map of Vietnam with "TUYÊN NGÔN ĐỘC LẬP" */}
          <g transform="translate(520, 0)">
            {/* S-Shaped Vietnam Map & Parchment Paper Background */}
            <path 
              d="M 50,20 
                 C 150,15 320,10 420,20 
                 C 450,80 430,120 380,150 
                 C 320,180 280,220 290,280 
                 C 300,340 380,380 350,450 
                 C 320,490 200,480 120,480 
                 C 80,450 110,380 90,320 
                 C 70,260 20,200 30,120 Z" 
              fill="url(#parchmentBg)" 
              filter="url(#dropShadowParchment)"
            />

            {/* Decorative Header: TUYÊN NGÔN ĐỘC LẬP */}
            <text x="240" y="60" textAnchor="middle" fill="#451A03" fontSize="24" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="1.5">
              TUYÊN NGÔN ĐỘC LẬP
            </text>

            {/* Historic Declaration Text Snippets Lines */}
            <g fill="#78350F" fontSize="8.5" fontFamily="Arial, Helvetica, sans-serif" opacity="0.85">
              <text x="70" y="90">"Tất cả mọi người đều sinh ra có quyền bình đẳng. Tạo hóa cho họ những quyền</text>
              <text x="65" y="106">không ai có thể xâm phạm được; trong những quyền ấy, có quyền được sống,</text>
              <text x="60" y="122">quyền tự do và quyền mưu cầu hạnh phúc."</text>
              <text x="60" y="138">Bản Tuyên ngôn Độc lập năm 1776 của nước Mỹ. Suy rộng ra, câu ấy có nghĩa là:</text>
              <text x="55" y="154">Tất cả các dân tộc trên thế giới đều sinh ra bình đẳng, dân tộc nào cũng có quyền sống,</text>
              <text x="55" y="170">quyền sung sướng và quyền tự do.</text>
              <text x="60" y="186">Bản Tuyên ngôn Nhân quyền và Dân quyền của Cách mạng Pháp năm 1791 cũng nói:</text>
              <text x="65" y="202">"Người ta sinh ra tự do và bình đẳng về quyền lợi, và phải luôn luôn được tự do..."</text>
              <text x="75" y="218">Nước Việt Nam có quyền hưởng tự do và độc lập, và sự thật đã thành một nước tự do độc lập.</text>
              <text x="85" y="234">Toàn thể dân tộc Việt Nam quyết đem tất cả tinh thần và lực lượng, tính mạng và của cải</text>
              <text x="95" y="250">để giữ vững quyền tự do, độc lập ấy!</text>
              
              <text x="110" y="280">Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam Muôn Năm!</text>
              <text x="120" y="300">Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập - Ngày 2 tháng 9 năm 1945</text>
            </g>

            {/* Hoàng Sa & Trường Sa Island Markers */}
            {/* HOÀNG SA */}
            <g transform="translate(330, 230)">
              <circle cx="0" cy="0" r="4" fill="#DC2626" />
              <circle cx="8" cy="-5" r="3" fill="#DC2626" />
              <circle cx="-6" cy="6" r="3" fill="#DC2626" />
              <text x="14" y="4" fill="#991B1B" fontSize="11" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif">HOÀNG SA</text>
            </g>

            {/* TRƯỜNG SA */}
            <g transform="translate(340, 370)">
              <circle cx="0" cy="0" r="4" fill="#DC2626" />
              <circle cx="10" cy="8" r="3" fill="#DC2626" />
              <circle cx="-8" cy="10" r="3" fill="#DC2626" />
              <circle cx="12" cy="-6" r="3" fill="#DC2626" />
              <text x="16" y="4" fill="#991B1B" fontSize="11" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif">TRƯỜNG SA</text>
            </g>
          </g>

          {/* 3. President Ho Chi Minh (Chủ Tịch Hồ Chí Minh) Stencil Portrait on the Left */}
          <g id="UncleHoPortrait" transform="translate(10, 30)">
            {/* White Body Contour & Khaki Suit Jacket Silhouette */}
            <path 
              d="M 20,470 
                 C 20,380 40,320 80,260 
                 C 100,230 140,210 180,210 
                 C 200,210 220,230 230,260 
                 L 260,260 
                 C 280,280 290,320 310,380 
                 C 320,410 330,440 340,470 Z" 
              fill="#FFFFFF" 
              stroke="#000000" 
              strokeWidth="4" 
            />

            {/* Collar & Jacket Details */}
            <path d="M 140,210 L 150,280 L 180,310 L 210,280 L 220,210" fill="none" stroke="#000000" strokeWidth="5" />
            <path d="M 180,310 L 180,470" stroke="#000000" strokeWidth="5" />
            {/* Buttons */}
            <circle cx="180" cy="340" r="6" fill="none" stroke="#000000" strokeWidth="4" />
            <circle cx="180" cy="420" r="6" fill="none" stroke="#000000" strokeWidth="4" />

            {/* Head & Facial Outline */}
            <path 
              d="M 120,180 
                 C 100,140 105,90 130,50 
                 C 160,10 220,10 260,35 
                 C 290,55 300,95 290,130 
                 C 280,160 260,190 230,210 
                 C 200,220 150,220 120,180 Z" 
              fill="#FFFFFF" 
              stroke="#000000" 
              strokeWidth="5" 
            />

            {/* Hair & Forehead Highlights */}
            <path d="M 140,45 C 160,25 210,20 250,35 C 270,50 280,75 270,95 C 250,80 210,70 170,80 Z" fill="#000000" />

            {/* Eyes, Eyebrows & Glasses/Wrinkle Accents */}
            <path d="M 160,105 C 175,98 190,98 200,105" stroke="#000000" strokeWidth="4" fill="none" />
            <path d="M 225,105 C 235,98 250,98 260,105" stroke="#000000" strokeWidth="4" fill="none" />
            <circle cx="180" cy="112" r="4" fill="#000000" />
            <circle cx="242" cy="112" r="4" fill="#000000" />

            {/* Nose */}
            <path d="M 210,110 L 215,138 L 202,142" stroke="#000000" strokeWidth="4" fill="none" />

            {/* Iconic Moustache & Beard (Râu Bác Hồ) */}
            <path d="M 180,148 C 195,142 225,142 245,148 C 250,165 230,172 210,168 C 190,172 175,165 180,148 Z" fill="#000000" />
            <path d="M 195,170 C 200,210 210,240 215,280 C 220,240 225,210 228,170 Z" fill="#000000" />

            {/* Vintage Historic Stand Microphone (Micro Lịch Sử Ngày 2/9/1945) */}
            <g transform="translate(280, 220)">
              {/* Ring Top Mic Head */}
              <circle cx="25" cy="20" r="22" fill="#FFFFFF" stroke="#000000" strokeWidth="5" />
              <circle cx="25" cy="20" r="14" fill="#000000" />
              <circle cx="25" cy="20" r="8" fill="#FFFFFF" />
              {/* Mic Shaft Stand */}
              <rect x="20" y="42" width="10" height="180" fill="#FFFFFF" stroke="#000000" strokeWidth="4" />
              <rect x="12" y="70" width="26" height="30" fill="#000000" />
            </g>
          </g>

          {/* 4. Bottom Decorative Red Ribbon */}
          <path d="M 0,470 L 1000,470 L 1000,500 L 0,500 Z" fill="#B91C1C" />
          <g fill="#FBBF24">
            <polygon points="100,485 103,492 110,492 105,496 107,500 100,497 93,500 95,496 90,492 97,492" />
            <polygon points="300,485 303,492 310,492 305,496 307,500 300,497 293,500 295,496 290,492 297,492" />
            <polygon points="500,485 503,492 510,492 505,496 507,500 500,497 493,500 495,496 490,492 497,492" />
            <polygon points="700,485 703,492 710,492 705,496 707,500 700,497 693,500 695,496 690,492 697,492" />
            <polygon points="900,485 903,492 910,492 905,496 907,500 900,497 893,500 895,496 890,492 897,492" />
          </g>
        </svg>
      )}
    </div>
  );
};

