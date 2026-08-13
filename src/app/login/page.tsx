import LoginForm from '@/components/LoginForm';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Image Container */}
      <div className="absolute inset-0 bg-[#d49a37] opacity-100"></div>

      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: "url('https://i.ytimg.com/vi/Vyd0Uc_eI4g/maxresdefault.jpg')" }}
      >
      </div>

      {/* Top Left Logo Area - Now visible on mobile but smaller! */}
      <div className="absolute top-6 left-6 z-10 sm:block">
        <Image 
          src="https://mdc.sch.id/wp-content/uploads/2023/04/website-sekolah-logo-New.png" 
          alt="MDC Christian School" 
          width={400} 
          height={90} 
          className="w-auto h-8 md:h-12 lg:h-16 drop-shadow-md"
          priority
        />
      </div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-4xl px-4 sm:px-8 mt-2 md:mt-0">
        <h2 className="mb-6 md:mb-8 text-center text-4xl md:text-5xl font-bold text-white drop-shadow-md">
          Log In
        </h2>
        
        <LoginForm />
      </div>
    </div>
  );
}