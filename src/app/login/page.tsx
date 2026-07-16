import LoginForm from '@/components/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Image Container */}
              <div className="absolute inset-0 bg-[#d49a37] opacity-100"></div>

      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-50"
        // Notice how the style prop is inside the opening <div ... > tag now
        style={{ backgroundImage: "url('https://i.ytimg.com/vi/Vyd0Uc_eI4g/maxresdefault.jpg')" }}
      >
        {/* The Orange Overlay - using the separated opacity fix */}
      </div>

      {/* Top Left Logo Area */}
      <div className="absolute top-6 left-6 z-10 hidden sm:block">
        <Image 
          src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" 
          alt="MDC Christian School" 
          width={400} 
          height={90} 
          className="w-auto h-12 md:h-16 drop-shadow-md"
          priority
        />
      </div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-5xl px-4 sm:px-8">
  <h2 className="mb-8 text-center text-5xl font-bold text-white drop-shadow-md">
    Log In
  </h2>
  
  <LoginForm />
</div>
    </div>
  );
}