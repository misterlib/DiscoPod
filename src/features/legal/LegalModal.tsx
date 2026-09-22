import { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Lock,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { api } from "../../convexApi";
import type { Id } from "../../../convex/_generated/dataModel";

export type LegalModalTab = "terms" | "privacy" | "takedown";

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalModalTab;
  prefilledShow?: {
    showId?: string;
    title: string;
    rssUrl?: string;
  } | null;
  onClose: () => void;
}

export function LegalModal({
  isOpen,
  initialTab = "terms",
  prefilledShow = null,
  onClose,
}: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<LegalModalTab>(initialTab);

  // Takedown Form State
  const [takedownTitle, setTakedownTitle] = useState(prefilledShow?.title || "");
  const [takedownFeedUrl, setTakedownFeedUrl] = useState(prefilledShow?.rssUrl || "");
  const [takedownEmail, setTakedownEmail] = useState("");
  const [takedownReason, setTakedownReason] = useState("Creator or rights holder takedown request");
  const [takedownProofNotes, setTakedownProofNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [takedownResult, setTakedownResult] = useState<{
    success: boolean;
    verified?: boolean;
    requiresHumanReview?: boolean;
    message: string;
  } | null>(null);

  // Queries for live anti-competitor verification and agent inbox address
  const showPreview = useQuery(
    api.takedowns.getShowTakedownPreview,
    takedownTitle.trim()
      ? {
          title: takedownTitle.trim(),
          showId: prefilledShow?.showId ? (prefilledShow.showId as Id<"shows">) : undefined,
        }
      : "skip",
  );
  const agentInfo = useQuery(api.takedowns.getAgentMailContactInfo, {});
  const agentInboxEmail = agentInfo?.agentMailInbox || "discopod-main@agentmail.to";

  const submitTakedownMutation = useMutation(api.takedowns.submitTakedown);

  useEffect(() => {
    setActiveTab(initialTab);
    if (prefilledShow) {
      setTakedownTitle(prefilledShow.title);
      setTakedownFeedUrl(prefilledShow.rssUrl || "");
    }
  }, [initialTab, prefilledShow]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleTakedownSubmit(e: FormEvent) {
    e.preventDefault();
    if (!takedownTitle.trim()) return;

    setIsSubmitting(true);
    setTakedownResult(null);

    try {
      const res = await submitTakedownMutation({
        showId: prefilledShow?.showId ? (prefilledShow.showId as Id<"shows">) : undefined,
        title: takedownTitle.trim(),
        feedUrl: takedownFeedUrl.trim() || undefined,
        requesterEmail: takedownEmail.trim() || undefined,
        requesterProofNotes: takedownProofNotes.trim() || undefined,
        reason: takedownReason.trim() || undefined,
        source: "web_modal",
      });

      setTakedownResult({
        success: res.success,
        verified: res.verified,
        requiresHumanReview: res.requiresHumanReview,
        message: res.message,
      });
    } catch (err) {
      setTakedownResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to process takedown request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border-4 sm:border-8 border-disco-caramel bg-disco-cream shadow-2xl text-disco-dark overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-disco-dark/15 bg-white/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-disco-dark p-2 text-disco-cream">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-['Lato'] text-lg sm:text-xl font-black uppercase tracking-tight text-disco-dark leading-tight">
                Legal Center &amp; Policies
              </h2>
              <p className="text-[11px] font-bold text-disco-dark/60 uppercase tracking-wider">
                DiscoPod Platform Standards
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-sm transition-transform hover:scale-110 active:scale-95 cursor-pointer"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-8 pt-3 pb-2 border-b border-disco-dark/10 bg-disco-dark/5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "terms"
                ? "bg-disco-dark text-disco-cream shadow-sm"
                : "bg-white/50 text-disco-dark/70 hover:bg-white/80 hover:text-disco-dark"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Terms of Service</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "privacy"
                ? "bg-disco-dark text-disco-cream shadow-sm"
                : "bg-white/50 text-disco-dark/70 hover:bg-white/80 hover:text-disco-dark"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Privacy Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("takedown")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "takedown"
                ? "bg-disco-rose text-disco-dark shadow-sm"
                : "bg-white/50 text-disco-dark/70 hover:bg-white/80 hover:text-disco-dark"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Zero-Question Takedown</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 text-xs sm:text-sm text-disco-dark/90 leading-relaxed font-['Lato'] space-y-6 custom-scrollbar">
          {/* TAB 1: TERMS OF SERVICE */}
          {activeTab === "terms" ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs">
                <p className="font-bold text-amber-950">
                  <strong>Notice &amp; Summary:</strong> DiscoPod is an automated podcast discovery
                  engine. We index public RSS feeds, curate short 15–45 second hook snippets under
                  fair use doctrine, and redirect listeners to original publisher feeds. We provide
                  this tool strictly &ldquo;AS-IS&rdquo; with complete limitation of liability.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">1. Acceptance of Terms</h3>
                <p>
                  By accessing, browsing, or using DiscoPod (the &ldquo;Service&rdquo;), you
                  acknowledge that you have read, understood, and agree to be bound by these Terms
                  and Conditions. If you do not agree, you must immediately discontinue using the
                  Service.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  2. Automated Public RSS Aggregation &amp; Indexing
                </h3>
                <p>
                  DiscoPod operates as an autonomous indexing and search technology for publicly
                  distributed audio content. Podcasts and metadata displayed on the platform are
                  gathered from publicly published RSS feeds and open directory registries (such as
                  the Apple Podcasts directory). DiscoPod does not verify, edit, or endorse third-party
                  podcast content.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  3. Transformative Fair Use of Audio Snippets
                </h3>
                <p>
                  Audio clips made available for preview on DiscoPod are short, transformative 15–45
                  second excerpts generated via automated transcript analysis solely for discovery,
                  identification, commentary, and navigational indexing purposes. DiscoPod does not
                  host, store, or duplicate full-length podcast audio files. Full episode links route
                  directly to canonical publisher streams or external podcast distributors (e.g.,
                  Spotify, Apple Podcasts, YouTube).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  4. No Affiliation or Endorsement
                </h3>
                <p>
                  All podcast titles, artwork, audio recordings, trademarks, and host identities are
                  the sole property of their respective creators and publishers. The display of any
                  podcast on DiscoPod does not imply any sponsorship, endorsement, commercial
                  affiliation, or partnership by or with the podcast creators.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  5. Complete Disclaimer of Warranties
                </h3>
                <p className="uppercase font-bold text-disco-dark/80 text-[11px] sm:text-xs">
                  THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
                  BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR
                  OTHERWISE. DISCOPOD EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED
                  TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                  ACCURACY, TITLE, AND NON-INFRINGEMENT. DISCOPOD DOES NOT WARRANT THAT THE SERVICE
                  WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL
                  COMPONENTS.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  6. Strict Limitation of Liability
                </h3>
                <p className="uppercase font-bold text-disco-dark/80 text-[11px] sm:text-xs">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, UNDER NO CIRCUMSTANCES SHALL
                  DISCOPOD, ITS CREATORS, CONTRIBUTORS, DEVELOPERS, DIRECTORS, AFFILIATES, OR
                  LICENSORS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT,
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT
                  NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, REVENUE, GOODWILL, USE, DATA, OR OTHER
                  INTANGIBLE LOSSES ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO, USE OF, OR
                  INABILITY TO USE THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT,
                  TORT, STRICT LIABILITY, OR OTHERWISE), EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
                  DAMAGES. IN NO EVENT SHALL DISCOPOD&apos;S TOTAL AGGREGATE LIABILITY EXCEED
                  ONE UNITED STATES DOLLAR ($1.00 USD).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  7. Zero-Question Takedown Safe Harbor
                </h3>
                <p>
                  DiscoPod maintains a zero-friction, unconditional Takedown Policy. If you are a
                  podcast creator or copyright owner and wish to have your show removed from
                  DiscoPod, we will honor your request immediately and permanently tombstone your feed
                  from our index with zero questions asked. Please see the{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("takedown")}
                    className="font-bold underline text-disco-rose cursor-pointer"
                  >
                    Zero-Question Takedown tab
                  </button>{" "}
                  for details.
                </p>
              </section>
            </div>
          ) : null}

          {/* TAB 2: PRIVACY POLICY */}
          {activeTab === "privacy" ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs">
                <p className="font-bold text-emerald-950 text-sm">
                  <strong>The Simple Privacy Rule:</strong> We do not sell any data. We do not collect
                  any personal data from people searching or listening. All podcast data on DiscoPod is
                  already publicly accessible on the open web.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">1. We Do Not Sell Any Data</h3>
                <p className="text-xs sm:text-sm text-disco-dark/80 leading-relaxed">
                  DiscoPod does not sell, rent, monetize, or broker personal information to advertisers,
                  data brokers, or third parties. There are no advertising trackers or commercial data sales.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  2. We Don&apos;t Collect Data From Searchers
                </h3>
                <p className="text-xs sm:text-sm text-disco-dark/80 leading-relaxed">
                  You can search, browse, and listen completely anonymously:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-disco-dark/80 leading-relaxed">
                  <li>No account, email, or login is required to search or listen.</li>
                  <li>We do not log personal search history, IP addresses, or build user profiles.</li>
                  <li>We do not use tracking cookies or third-party behavioral analytics.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  3. All Other Data Is Publicly Accessible
                </h3>
                <p className="text-xs sm:text-sm text-disco-dark/80 leading-relaxed">
                  All podcast metadata displayed on DiscoPod—including show titles, artwork, episode
                  descriptions, audio snippets, and creator contact emails—is derived strictly from
                  publicly accessible, open RSS feeds published openly on the web or public podcast directory
                  listings.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-disco-dark">
                  4. Permanent Opt-Out &amp; Suppression Guarantee
                </h3>
                <p className="text-xs sm:text-sm text-disco-dark/80 leading-relaxed">
                  If you are a podcaster and ask us to stop emailing you or to take down your show, we honor
                  it immediately with zero questions asked. Your feed and email address are permanently stored
                  in our suppression index (`takedownRequests` and `emailSuppressions`) so our system will never
                  re-index your podcast or send you any further communications.
                </p>
              </section>
            </div>
          ) : null}

          {/* TAB 3: ZERO-QUESTION TAKEDOWN POLICY & FORM */}
          {activeTab === "takedown" ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-900 font-black uppercase tracking-wider text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Our Zero-Question Takedown Guarantee</span>
                </div>
                <p className="text-rose-950 font-medium leading-relaxed">
                  If you are a podcaster, copyright holder, or authorized agent and prefer that your
                  show not be featured on DiscoPod, we honor your request immediately and
                  unconditionally with <strong>zero questions asked</strong> and no friction.
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-black text-disco-dark uppercase tracking-wide">
                  Why Shows are Tombstoned (Not Deleted)
                </h4>
                <p className="text-xs text-disco-dark/80">
                  When a takedown request is submitted, we do not simply delete the database record.
                  If a record were merely deleted, an automated directory search or a listener typing
                  your show&apos;s name could inadvertently re-index your RSS feed in the future.
                  Instead, our system records your podcast in a permanent{" "}
                  <strong>suppression tombstone registry</strong>. All automated ingest pipelines and
                  live search queries cross-reference this tombstone to ensure your feed is{" "}
                  <strong>permanently excluded and never re-mapped</strong>.
                </p>
              </section>

              {/* Takedown Form */}
              <form
                onSubmit={handleTakedownSubmit}
                className="rounded-2xl bg-white/70 border border-disco-dark/15 p-4 sm:p-6 space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-['Lato'] text-sm font-black uppercase tracking-wider text-disco-dark">
                    Creator Takedown &amp; Tombstone Request
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                      showPreview?.hasHostEmail
                        ? "bg-amber-500/15 text-amber-900 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-800 border-rose-500/30"
                    }`}
                  >
                    Anti-Competitor Protected
                  </span>
                </div>

                {/* Anti-Competitor Security Notice */}
                {showPreview?.showFound && showPreview.maskedEmailOnFile ? (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-disco-dark flex items-start gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-left">
                      <div className="font-black text-amber-950">
                        Anti-Competitor Protection Active
                      </div>
                      <p className="text-[11px] text-disco-dark/85 leading-relaxed">
                        To prevent competitor shows from maliciously taking down your podcast, requests from the verified email on file (
                        <code className="bg-amber-100 font-bold px-1.5 py-0.5 rounded text-disco-dark border border-amber-300">
                          {showPreview.maskedEmailOnFile}
                        </code>
                        ) are tombstoned immediately.
                      </p>
                      <p className="text-[11px] text-disco-dark/75 leading-relaxed">
                        If your email differs, your request is queued for our human admin team to verify ownership before removal.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 text-xs text-left">
                  <div>
                    <label className="block font-bold text-disco-dark/80 mb-1">
                      Podcast Show Title <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={takedownTitle}
                      onChange={(e) => setTakedownTitle(e.target.value)}
                      placeholder="e.g. All-In Podcast"
                      className="w-full rounded-xl border border-disco-dark/20 bg-white px-3 py-2 text-disco-dark font-medium outline-none focus:border-disco-dark focus:ring-1 focus:ring-disco-dark"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-disco-dark/80 mb-1">
                      RSS Feed URL or Apple Podcasts URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={takedownFeedUrl}
                      onChange={(e) => setTakedownFeedUrl(e.target.value)}
                      placeholder="https://feeds.example.com/podcast.rss"
                      className="w-full rounded-xl border border-disco-dark/20 bg-white px-3 py-2 text-disco-dark font-medium outline-none focus:border-disco-dark focus:ring-1 focus:ring-disco-dark"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-disco-dark/80 mb-1">
                      Your Email Address <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={takedownEmail}
                      onChange={(e) => setTakedownEmail(e.target.value)}
                      placeholder="creator@example.com"
                      className="w-full rounded-xl border border-disco-dark/20 bg-white px-3 py-2 text-disco-dark font-medium outline-none focus:border-disco-dark focus:ring-1 focus:ring-disco-dark"
                    />
                    <span className="text-[10px] text-disco-dark/60 block mt-0.5">
                      Must match the public RSS email on file for instant removal. If different, human review will be required.
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-disco-dark/80 mb-1">
                      Verification Proof / Role Notes
                    </label>
                    <textarea
                      rows={2}
                      value={takedownProofNotes}
                      onChange={(e) => setTakedownProofNotes(e.target.value)}
                      placeholder="Important: How can our human admin verify that you are the host or rights holder?"
                      className="w-full rounded-xl border border-disco-dark/20 bg-white px-3 py-2 text-disco-dark font-medium outline-none focus:border-disco-dark focus:ring-1 focus:ring-disco-dark resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-disco-dark/80 mb-1">
                      Reason / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={takedownReason}
                      onChange={(e) => setTakedownReason(e.target.value)}
                      placeholder="Creator or rights holder takedown request"
                      className="w-full rounded-xl border border-disco-dark/20 bg-white px-3 py-2 text-disco-dark font-medium outline-none focus:border-disco-dark focus:ring-1 focus:ring-disco-dark"
                    />
                  </div>
                </div>

                {takedownResult ? (
                  <div
                    className={`rounded-xl border p-3.5 text-xs flex items-start gap-2.5 text-left ${
                      takedownResult.verified
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-950 font-semibold"
                        : takedownResult.requiresHumanReview
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-950 font-semibold"
                        : "bg-rose-500/15 border-rose-500/30 text-rose-950 font-semibold"
                    }`}
                  >
                    {takedownResult.verified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : takedownResult.requiresHumanReview ? (
                      <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{takedownResult.message}</span>
                  </div>
                ) : null}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting || !takedownTitle.trim() || !takedownEmail.trim()}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider text-xs px-5 py-2.5 shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? "Verifying & Tombstoning..." : "Submit Takedown Request"}</span>
                  </button>
                </div>
              </form>

              <div className="pt-2 text-center text-xs text-disco-dark/70 space-y-1">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <Mail className="h-3.5 w-3.5 text-disco-navy inline" />
                  <span>Prefer email? Send to our agent inbox at </span>
                  <a
                    href={`mailto:${agentInboxEmail}`}
                    className="font-bold underline text-disco-navy hover:text-disco-dark"
                  >
                    {agentInboxEmail}
                  </a>
                </div>
                <p className="text-[11px] text-disco-dark/50">
                  Requests sent from the verified email on file or replied directly to any outreach email are executed immediately. Unverified emails are queued for human review.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-8 py-3 border-t border-disco-dark/15 bg-white/40 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-bold text-disco-dark/50 uppercase tracking-widest">
            DiscoPod Legal · Zero-Question Safe Harbor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-disco-dark hover:bg-disco-navy text-white text-xs font-black uppercase tracking-wider px-5 py-2 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
