import { useState } from "react";
import {
  Sparkles,
  Flame,
  Database,
  Globe,
  Bot,
  Mail,
  Box,
  Layers,
  ExternalLink,
  Code2,
  Heart,
  Compass,
} from "lucide-react";
import { LegalModal, type LegalModalTab } from "../legal/LegalModal";

export function AboutPanel({
  onOpenLegal,
}: {
  onOpenLegal?: (tab: LegalModalTab) => void;
} = {}) {
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalModalTab>("terms");

  const handleLegalClick = (tab: LegalModalTab) => {
    if (onOpenLegal) {
      onOpenLegal(tab);
    } else {
      setLegalTab(tab);
      setLegalOpen(true);
    }
  };
  const technologies = [
    {
      name: "Convex",
      url: "https://convex.dev",
      role: "Reactive Full-Stack Engine",
      icon: Database,
      accentColor: "bg-amber-500/15 text-amber-900 border-amber-500/30",
      description:
        "The real-time backbone of DiscoPod. Powers live queries, transactional mutations, 1536-dimensional vector search indexing, background asynchronous ingestion pipelines, scheduled tasks (ctx.scheduler.runAfter), and HTTP webhook endpoints with zero server overhead.",
    },
    {
      name: "Firecrawl",
      url: "https://firecrawl.dev",
      role: "Autonomous Web Research Agent",
      icon: Globe,
      accentColor: "bg-orange-500/15 text-orange-900 border-orange-500/30",
      description:
        "A 4-phase autonomous researcher that resolves canonical podcast domains, bypasses feed redirects, scrapes co-hosts and verified social handles, uncovers listener sentiment and reviews, and synthesizes structured 'Show Your Work' research dossiers.",
    },
    {
      name: "OpenAI",
      url: "https://openai.com",
      role: "Narrative Intelligence & Embeddings",
      icon: Bot,
      accentColor: "bg-emerald-500/15 text-emerald-900 border-emerald-500/30",
      description:
        "GPT-4o and GPT-4o-mini digest episode transcripts and creator chapter markers to identify viral 15–45s listener preview hooks with custom quote rationales. text-embedding-3-small generates 1536-dim vector embeddings for instant semantic search.",
    },
    {
      name: "AgentMail",
      url: "https://agentmail.to",
      role: "Two-Way Creator Email Loop",
      icon: Mail,
      accentColor: "bg-sky-500/15 text-sky-900 border-sky-500/30",
      description:
        "Powered by @agentmail/convex. When a podcast is mapped, hosts receive an automated inbox notification. Creators can verify ownership, customize featured teaser quotes, re-slice snippet timestamps, or chat with DiscoPod AI directly via plain email replies.",
    },
    {
      name: "React Three Fiber & Three.js",
      url: "https://r3f.docs.pmnd.rs",
      role: "Interactive 3D Discoball",
      icon: Box,
      accentColor: "bg-indigo-500/15 text-indigo-900 border-indigo-500/30",
      description:
        "Dynamically projects podcast cover artwork across a spherical Fibonacci Golden Spiral lattice with 360° mouse drag physics, radial tile hover pop-outs, and glowing bezel highlights for verified hosts.",
    },
    {
      name: "React 19 & React Router 7",
      url: "https://react.dev",
      role: "Modern Discovery Architecture",
      icon: Layers,
      accentColor: "bg-rose-500/15 text-rose-900 border-rose-500/30",
      description:
        "Delivers a fluid, app-grade web experience featuring a Tinder-style swipeable deck with physics-based gesture tilt, animated 24-bar audio waveforms, transcript inspections, and responsive layouts built with Tailwind CSS.",
    },
  ];

  return (
    <div className="w-full h-full flex-1 flex flex-col items-center text-left overflow-y-auto max-h-[calc(100dvh-160px)] sm:max-h-[calc(100dvh-220px)] pr-1 sm:pr-2 custom-scrollbar">
      {/* Header Section */}
      <div className="w-full flex flex-col items-center justify-center text-center pb-6 border-b border-disco-dark/15 mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-disco-caramel/20 border border-disco-caramel/40 px-3.5 py-1 font-['Lato'] text-[11px] sm:text-xs font-black uppercase tracking-wider text-disco-dark mb-2">
          <Flame className="h-3.5 w-3.5 text-disco-caramel fill-disco-caramel" />
          Convex All Gas Hackathon 2026
        </div>

        <h1 className="font-['Lato'] text-2xl sm:text-4xl font-black uppercase tracking-tight text-disco-dark mb-3">
          Podcast Discovery, Reimagined
        </h1>

        <p className="max-w-2xl font-['Lato'] text-sm sm:text-base font-semibold text-disco-dark/80 leading-relaxed">
          Why are podcasts still discovered through static top-charts and wall-of-text directories?{" "}
          <strong className="text-disco-dark font-black">DiscoPod</strong> maps the audio universe
          onto an interactive 3D discoball, mines the web for deep context, extracts punchy 15–45s
          audio hook snippets with AI, and lets listeners swipe through recommendations Tinder-style.
        </p>
      </div>

      {/* Technology Stack Grid */}
      <div className="w-full mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-disco-caramel" />
          <h2 className="font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-widest text-disco-dark/70">
            Engineered with All Gas — The Tech Stack
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {technologies.map((tech) => {
            const IconComponent = tech.icon;
            return (
              <div
                key={tech.name}
                className="group relative rounded-2xl bg-white/50 hover:bg-white/80 border border-disco-dark/10 p-4 sm:p-5 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border ${tech.accentColor} shadow-2xs`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-['Lato'] text-base font-black text-disco-dark leading-tight">
                          {tech.name}
                        </h3>
                        <p className="font-['Lato'] text-[11px] font-bold text-disco-dark/60 uppercase tracking-wider">
                          {tech.role}
                        </p>
                      </div>
                    </div>

                    <a
                      href={tech.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-disco-dark hover:bg-disco-navy text-white px-3 py-1.5 text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
                      title={`Visit ${tech.name}`}
                    >
                      <span>Visit</span>
                      <ExternalLink className="h-3 w-3 text-disco-cream" />
                    </a>
                  </div>

                  <p className="font-['Lato'] text-xs sm:text-[13px] font-medium text-disco-dark/85 leading-relaxed mt-2">
                    {tech.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Creator & MagicMakrs Section */}
      <div className="w-full rounded-2xl bg-disco-navy/5 border border-disco-dark/15 p-5 sm:p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-disco-rose font-['Lato']">
              <Heart className="h-3.5 w-3.5 fill-disco-rose" />
              About the Creator
            </div>
            <h3 className="font-['Lato'] text-xl sm:text-2xl font-black text-disco-dark">
              Kurt Libby · MagicMakrs
            </h3>
            <p className="font-['Lato'] text-xs sm:text-sm font-medium text-disco-dark/80 leading-relaxed">
              I&apos;m a <strong className="text-disco-dark font-black">serial app developer</strong> and the
              creator behind <strong className="text-disco-dark font-black">MagicMakrs</strong>. Built
              for the <span className="font-bold text-disco-dark">Convex All Gas Hackathon</span>,
              DiscoPod was born from a love for indie podcasts and a conviction that discovering
              great voices should be serendipitous, visual, and delightfully fast.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 sm:shrink-0">
            <a
              href="https://magicmakrs.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-disco-dark hover:bg-disco-navy text-white px-5 py-2.5 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10"
            >
              <Compass className="h-4 w-4 text-disco-caramel" />
              <span>magicmakrs.com</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-90 text-disco-cream" />
            </a>

            <a
              href="https://github.com/misterlib/DiscoPod"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-disco-navy hover:bg-disco-dark text-white px-5 py-2.5 font-['Lato'] text-xs sm:text-sm font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/10"
            >
              <Code2 className="h-4 w-4 text-disco-rose" />
              <span>GitHub Repo</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-90 text-disco-cream" />
            </a>
          </div>
        </div>
      </div>

      {/* Footer Note & Legal Links */}
      <div className="w-full flex flex-col items-center justify-center py-3 text-center space-y-2 border-t border-disco-dark/15 pt-5 mt-2">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold text-disco-dark/80 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => handleLegalClick("terms")}
            className="hover:text-disco-dark underline hover:decoration-2 cursor-pointer transition-colors"
          >
            Terms of Service &amp; Liability
          </button>
          <span className="text-disco-dark/40">•</span>
          <button
            type="button"
            onClick={() => handleLegalClick("privacy")}
            className="hover:text-disco-dark underline hover:decoration-2 cursor-pointer transition-colors"
          >
            Privacy Policy
          </button>
          <span className="text-disco-dark/40">•</span>
          <button
            type="button"
            onClick={() => handleLegalClick("takedown")}
            className="text-rose-700 hover:text-rose-900 font-black underline hover:decoration-2 cursor-pointer transition-colors"
          >
            Zero-Question Takedowns
          </button>
        </div>
        <span className="font-['Lato'] text-[11px] font-bold text-disco-dark/50 uppercase tracking-widest">
          DiscoPod · Crafted with All Gas · 2026
        </span>
      </div>

      <LegalModal
        isOpen={legalOpen}
        initialTab={legalTab}
        onClose={() => setLegalOpen(false)}
      />
    </div>
  );
}
