import React, { useEffect, useRef, useCallback } from 'react';

declare const gsap: any;

interface IntroAnimationProps {
  onEnd: () => void;
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onEnd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<any>(null);

  const handleSkip = useCallback(() => {
    if (timelineRef.current) {
      // Avança a animação para o final para uma transição suave
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
             if(timelineRef.current) {
                timelineRef.current.seek(timelineRef.current.duration());
             }
        }
      });
    } else {
        onEnd();
    }
  }, [onEnd]);

  // Animação de fundo de Plexus
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    let particleCount = 60;
    const maxDistance = 120;
    
    if(window.innerWidth < 768) particleCount = 40;


    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = Math.random() * 1.5 + 1;
        this.vx = Math.random() * 0.5 - 0.25;
        this.vy = Math.random() * 0.5 - 0.25;
      }
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = 'rgba(45, 212, 191, 0.4)'; // Tom de azul esverdeado
        ctx.fill();
      }
      update() {
        if (this.x > canvas.width || this.x < 0) this.vx = -this.vx;
        if (this.y > canvas.height || this.y < 0) this.vy = -this.vy;
        this.x += this.vx;
        this.y += this.vy;
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const connect = () => {
        if (!ctx) return;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                const distance = Math.sqrt(
                    (particles[a].x - particles[b].x) ** 2 +
                    (particles[a].y - particles[b].y) ** 2
                );
                if (distance < maxDistance) {
                    ctx.strokeStyle = `rgba(45, 212, 191, ${1 - distance / maxDistance})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      connect();
      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    init();
    animate();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Linha do tempo da introdução com GSAP
  useEffect(() => {
    if (typeof gsap === 'undefined') {
      console.error('GSAP not loaded. Skipping intro.');
      onEnd();
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => {
         gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.inOut',
            onComplete: onEnd
        });
      }, delay: 0.5 });
      timelineRef.current = tl;

      // Texto de boas-vindas inicial
      tl.from(".line-inner", { y: '120%', opacity: 0, stagger: 0.2, duration: 1, ease: "power3.out" })
        .to(".line-inner", { opacity: 0, y: '-50%', stagger: 0.1, duration: 0.6, ease: "power2.in" }, "+=1.5");
      
      // Revelação das funcionalidades
      tl.to(".welcome-text", { opacity: 0, duration: 0.5, ease: "power2.in" });
      tl.from(".features-container", { opacity: 0, duration: 1 }, "-=0.2");

      // Anima cada funcionalidade
      const features = gsap.utils.toArray('.feature-item');
      features.forEach((feature: any) => {
          const icon = feature.querySelector('.feature-icon svg');
          const paths = icon.querySelectorAll('path, rect, polyline, circle');
          const text = feature.querySelector('.feature-text');

          tl.from(feature, { opacity: 0, y: 30, duration: 0.8, ease: "power3.out" }, "-=0.3");
          paths.forEach((path: any) => {
            const length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
          });
          tl.to(paths, { strokeDashoffset: 0, duration: 1.2, stagger: 0.1, ease: "power2.inOut" });
          tl.from(text, { opacity: 0, y: 15, duration: 0.7, ease: "power3.out" }, "-=0.9");
          tl.to(feature, { opacity: 0, y: -30, duration: 0.7, ease: "power2.in" }, "+=1.8");
      });
      
      // Tela final
      tl.fromTo(".powered-by, .enter-btn", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, stagger: 0.3, ease: "power3.out" });

    }, containerRef);

    return () => {
      ctx.revert();
      timelineRef.current = null;
    };
  }, [onEnd]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-[100] text-white font-sans overflow-hidden">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full opacity-40"></canvas>
      
      <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-4">

        {/* Estágio 1: Texto de Boas-vindas */}
        <div className="welcome-text absolute inset-0 flex flex-col items-center justify-center space-y-4">
          <div className="text-4xl md:text-6xl lg:text-7xl font-light">
            <div className="line overflow-hidden"><div className="line-inner">Bem-vindo ao</div></div>
          </div>
          <div className="text-5xl md:text-7xl lg:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
            <div className="line overflow-hidden"><div className="line-inner">Player com IA</div></div>
          </div>
        </div>
        
        {/* Estágio 2: Funcionalidades */}
        <div className="features-container opacity-0 absolute inset-0 flex flex-col items-center justify-center space-y-12 md:space-y-16">
            <div className="feature-item opacity-0 flex flex-col items-center gap-4">
                <div className="feature-icon">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>
                </div>
                <p className="feature-text opacity-0 text-xl md:text-3xl lg:text-4xl font-light">IPTV de todo o mundo.</p>
            </div>
            <div className="feature-item opacity-0 flex flex-col items-center gap-4">
                <div className="feature-icon">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m13 14-4 4 4 4"/><path d="M10.5 10.5c.5.5.5 1.5.5 2.5s0 2-.5 2.5"/><path d="M17 11c1.5 0 3 .5 3 2.5S18.5 16 17 16"/><path d="M7 11v-1a2 2 0 0 1 2-2h1"/><path d="M15 11h1a2 2 0 0 1 2 2v1"/><path d="M12 6.5A2.5 2.5 0 0 1 14.5 4h0A2.5 2.5 0 0 1 17 6.5V11"/><path d="M8.5 4A2.5 2.5 0 0 0 6 6.5V11"/></svg>
                </div>
                <p className="feature-text opacity-0 text-xl md:text-3xl lg:text-4xl font-light">Tradução e Dublagem em tempo real.</p>
            </div>
             <div className="feature-item opacity-0 flex flex-col items-center gap-4">
                <div className="feature-icon">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>
                </div>
                <p className="feature-text opacity-0 text-xl md:text-3xl lg:text-4xl font-light">Explore Rádios Globais com IA.</p>
            </div>
        </div>

      </div>
      
      {/* Tela Final */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center space-y-6 w-full px-4">
        <div className="powered-by opacity-0 text-gray-400 text-lg flex items-center justify-center gap-2">
            <p>Desenvolvido com a API do</p>
            <svg height="24" viewBox="0 0 28 28" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M14 27.5C6.5467 27.5.5 21.4533.5 14 .5 6.5467 6.5467.5 14 .5c7.4533.5 13.5 6.5467 13.5 13.5 0 7.4533-6.0467 13.5-13.5 13.5Z" fill="#0057ff"></path><path d="M22.0134 16.2267C21.36 18.36 20.0934 20.0933 18.36 21.36c-1.12.8267-2.4533 1.3467-3.8666 1.48V14h9.3866c-.1866.8267-.56 1.5867-1.0666 2.2267Z" fill="#fff"></path><path d="M14 22.84c-1.4133-.1333-2.7466-.6533-3.8666-1.48C8.36 20.0933 7.09336 18.36 6.44002 16.2267c-.50666-.64-.88-1.4-1.06666-2.2267H14v8.84Z" fill="#0c1d59"></path><path d="M5.37336 11.7733c.18666-.8266.56-1.5866 1.06666-2.2266C7.09336 7.42 8.36 5.6867 10.1334 4.4133c1.12-.8266 2.4533-1.3466 3.8666-1.48V11.7733H5.37336Z" fill="#fff"></path><path d="M14 2.9333c1.4133.1334 2.7467.6534 3.8667 1.48 1.7733 1.2734 3.04 3.0067 3.6933 5.1467.5067.64.88 1.4 1.0667 2.2267H14V2.9333Z" fill="#0c1d59"></path></svg>
            <span className="font-semibold text-teal-400">Gemini</span>
        </div>
        <button
          onClick={handleSkip}
          className="enter-btn opacity-0 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-teal-500/30"
        >
          Entrar
        </button>
      </div>

       <style>{`
          .feature-icon svg path, .feature-icon svg rect, .feature-icon svg polyline, .feature-icon svg circle {
            stroke: #2dd4bf;
          }
        `}</style>
    </div>
  );
};

export default IntroAnimation;