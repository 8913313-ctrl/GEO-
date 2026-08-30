import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ProductCatalog } from './components/ProductCatalog';
import { AgencyBrandsSection } from './components/AgencyBrandsSection';
import { CalculatorSection } from './components/CalculatorSection';
import { VirtualMonitor } from './components/VirtualMonitor';
import { SolutionsSection } from './components/SolutionsSection';
import { SuccessCasesSection } from './components/SuccessCasesSection';
import { ContactSupportSection } from './components/ContactSupportSection';
import { AboutCertificates } from './components/AboutCertificates';
import { Footer } from './components/Footer';
import { AiConsultantModal } from './components/AiConsultantModal';
import { QuoteRequestModal } from './components/QuoteRequestModal';
import { InitialPageBootSkeleton } from './components/SkeletonLoader';
import { Bot, Calculator, PhoneCall } from 'lucide-react';
import { fetchSiteBootstrap } from './api/siteClient';
import { applyUpsBootstrap } from './data/siteAdapter';

export default function App() {
  const [activeSection, setActiveSection] = useState('hero');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [bootProgress, setBootProgress] = useState(10);
  const [isBooting, setIsBooting] = useState(true);
  const [, setSiteRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchSiteBootstrap(controller.signal)
      .then((bootstrap) => { applyUpsBootstrap(bootstrap); setSiteRevision((value) => value + 1); })
      .catch(() => { /* Local AI Studio preview may not have the central CMS yet. Keep the authored fallback. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setBootProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setIsBooting(false), 250);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20 + 20);
      });
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const handleOpenAiConsultantWithData = (data?: any) => {
    setInitialData(data || null);
    setAiModalOpen(true);
  };

  const handleOpenQuoteModalWithData = (data?: any) => {
    setInitialData(data || null);
    setQuoteModalOpen(true);
  };

  const scrollToCalculator = () => {
    setActiveSection('calculator');
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToProducts = () => {
    setActiveSection('products');
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Initial Boot Self-Check Skeleton Screen */}
      {isBooting && <InitialPageBootSkeleton progress={bootProgress} />}

      {/* Top Navigation */}
      <Navbar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onOpenCalculator={scrollToCalculator}
        onOpenAiConsultant={() => handleOpenAiConsultantWithData()}
        onOpenQuoteModal={() => handleOpenQuoteModalWithData()}
      />

      <main>
        {/* Hero Banner */}
        <HeroSection
          onOpenCalculator={scrollToCalculator}
          onOpenQuoteModal={() => handleOpenQuoteModalWithData()}
          onOpenAiConsultant={() => handleOpenAiConsultantWithData()}
          onNavigateToProducts={scrollToProducts}
        />

        {/* Product Catalog */}
        <ProductCatalog
          onOpenQuoteModalWithData={handleOpenQuoteModalWithData}
          onOpenAiConsultantWithData={handleOpenAiConsultantWithData}
        />

        {/* Agency Brands Strength, Authorization & Technical Advantage Showcase */}
        <AgencyBrandsSection
          onOpenQuoteModalWithData={handleOpenQuoteModalWithData}
          onOpenAiConsultantWithData={handleOpenAiConsultantWithData}
        />

        {/* Smart Engineering Sizing & Battery Calculator */}
        <CalculatorSection
          onOpenAiConsultantWithData={handleOpenAiConsultantWithData}
          onOpenQuoteModalWithData={handleOpenQuoteModalWithData}
        />

        {/* Interactive Virtual Outage & Mimic Flow Monitor */}
        <VirtualMonitor />

        {/* Industry Solutions */}
        <SolutionsSection
          onOpenQuoteModalWithData={handleOpenQuoteModalWithData}
        />

        {/* Success Cases */}
        <SuccessCasesSection
          onOpenQuoteModalWithData={handleOpenQuoteModalWithData}
        />

        {/* Contact Us & Technical Support Section */}
        <ContactSupportSection
          onOpenAiConsultant={() => handleOpenAiConsultantWithData()}
          onOpenQuoteModal={() => handleOpenQuoteModalWithData()}
        />

        {/* Enterprise Profile, Base & Certificates */}
        <AboutCertificates />
      </main>

      {/* Footer */}
      <Footer
        setActiveSection={setActiveSection}
        onOpenQuoteModal={() => handleOpenQuoteModalWithData()}
        onOpenCalculator={scrollToCalculator}
      />

      {/* Floating Action Buttons for Easy Access */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5">
        <button
          onClick={() => handleOpenAiConsultantWithData()}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl shadow-amber-500/30 transition-all hover:scale-105 group"
          title="咨询 AI 智能电源架构师"
        >
          <Bot className="w-5 h-5 text-slate-950 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">咨询 AI 电源专家</span>
        </button>

        <button
          onClick={scrollToCalculator}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
          title="智能选型与电池计算"
        >
          <Calculator className="w-5 h-5 text-slate-950" />
          <span className="hidden sm:inline">智能选型</span>
        </button>
      </div>

      {/* AI Pre-sales Specialist Modal */}
      <AiConsultantModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        initialContextData={initialData}
      />

      {/* Request Quote Modal */}
      <QuoteRequestModal
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        initialData={initialData}
      />

    </div>
  );
}
