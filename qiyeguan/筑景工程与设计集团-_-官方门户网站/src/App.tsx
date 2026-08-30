import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { BusinessSectors } from './components/BusinessSectors';
import { ProjectGallery } from './components/ProjectGallery';
import { CraftShowcase } from './components/CraftShowcase';
import { BudgetCalculator } from './components/BudgetCalculator';
import { FloorPlanViewer3D } from './components/FloorPlanViewer3D';
import { CompanyStrength } from './components/CompanyStrength';
import { ConsultationModal } from './components/ConsultationModal';
import { Footer } from './components/Footer';
import { Calculator, Calendar } from 'lucide-react';

export default function App() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleOpenCalculator = () => {
    // Scroll to section or open calculator directly
    const element = document.getElementById('budget-calculator');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenBooking = () => {
    setBookingOpen(true);
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    const element = document.getElementById('project-gallery');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F8] text-[#1A1A1A] font-sans selection:bg-[#C5A27D] selection:text-white">
      
      {/* Navbar */}
      <Navbar
        onOpenCalculator={handleOpenCalculator}
        onOpenBooking={handleOpenBooking}
      />

      {/* Hero Section */}
      <Hero
        onOpenCalculator={handleOpenCalculator}
        onOpenBooking={handleOpenBooking}
        onSelectProject={handleSelectProject}
      />

      {/* Core Business Sectors */}
      <BusinessSectors onOpenBooking={handleOpenBooking} />

      {/* Project Case Gallery */}
      <ProjectGallery
        onOpenBooking={handleOpenBooking}
        selectedProjectId={selectedProjectId}
        onClearSelectedProject={() => setSelectedProjectId(null)}
      />

      {/* Craftsmanship & BIM Showcase */}
      <CraftShowcase onOpenBooking={handleOpenBooking} />

      {/* Interactive AI Budget Calculator */}
      <BudgetCalculator onOpenBooking={handleOpenBooking} />

      {/* 3D Floorplan & Material Explorer */}
      <FloorPlanViewer3D />

      {/* Company Strength & Qualifications */}
      <CompanyStrength />

      {/* Footer */}
      <Footer
        onOpenCalculator={handleOpenCalculator}
        onOpenBooking={handleOpenBooking}
      />

      {/* Consultation Booking Modal */}
      <ConsultationModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />

      {/* Floating Action Bar (Bottom Right for Fast Engagement) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">

        {/* AI Calculator floating button */}
        <button
          onClick={handleOpenCalculator}
          className="w-12 h-12 rounded-full bg-white text-[#C5A27D] border border-[#C5A27D]/40 flex items-center justify-center shadow-lg hover:bg-[#1A1A1A] hover:text-white transition-all group backdrop-blur-md"
          title="AI 智能算造价"
        >
          <Calculator className="w-5 h-5" />
          <span className="absolute right-14 bg-[#1A1A1A] text-[#C5A27D] text-xs px-3 py-1.5 rounded-none border border-[#1A1A1A] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI 智能估算工程造价
          </span>
        </button>

        {/* Booking Floating button */}
        <button
          onClick={handleOpenBooking}
          className="w-14 h-14 rounded-full bg-[#1A1A1A] text-white font-bold flex items-center justify-center shadow-2xl hover:bg-[#C5A27D] transition-all group border border-[#1A1A1A]"
          title="预约量房设计"
        >
          <Calendar className="w-6 h-6" />
          <span className="absolute right-16 bg-[#1A1A1A] text-white text-xs px-3 py-1.5 rounded-none border border-[#1A1A1A] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            免费预约量房 / 建筑规划
          </span>
        </button>

      </div>

    </div>
  );
}
