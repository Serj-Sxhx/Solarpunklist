import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Leaf, Mail, CheckCircle2, Loader2, Zap, Radio, TreePine, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const subscribeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().optional(),
});
type SubscribeForm = z.infer<typeof subscribeSchema>;

export default function NewsletterPage() {
  const [subscribed, setSubscribed] = useState(false);

  const form = useForm<SubscribeForm>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { email: "", name: "" },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: SubscribeForm) => {
      const res = await apiRequest("POST", "/api/subscribe", data);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to subscribe");
      }
      return res.json();
    },
    onSuccess: () => setSubscribed(true),
  });

  const onSubmit = (data: SubscribeForm) => subscribeMutation.mutate(data);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-yellow-400 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-800/60 text-emerald-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-emerald-700/50">
            <Zap className="w-3.5 h-3.5" />
            AI-Curated Weekly
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
            🌿 SolarpunkDigest
          </h1>

          <p className="text-xl text-emerald-300 font-semibold mb-3">
            The Solarpunk Briefing
          </p>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-10 max-w-xl mx-auto">
            A weekly digest of breakthroughs in regenerative technology — solar microgrids, mesh networks, 
            autonomous drones, edge AI, and more. Researched by AI, curated by humans.
          </p>

          {subscribed ? (
            <div
              className="bg-emerald-800/50 border border-emerald-600/50 rounded-2xl p-8 max-w-md mx-auto"
              data-testid="text-subscribe-success"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white mb-2">You're in!</h2>
              <p className="text-gray-300 text-sm">
                Welcome to SolarpunkDigest. Your first issue will arrive soon.
              </p>
              <Link href="/">
                <Button variant="outline" className="mt-5 border-emerald-600 text-emerald-300 hover:bg-emerald-800">
                  Browse SolarpunkList →
                </Button>
              </Link>
            </div>
          ) : (
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-5">
                <Mail className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-semibold">Subscribe — it's free</span>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
                            className="h-11 text-base bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-emerald-500"
                            disabled={subscribeMutation.isPending}
                            data-testid="input-newsletter-email"
                          />
                        </FormControl>
                        <FormMessage className="text-red-300 text-xs" />
                      </FormItem>
                    )}
                  />

                  {subscribeMutation.isError && (
                    <p className="text-red-300 text-xs text-center" data-testid="text-subscribe-error">
                      {subscribeMutation.error instanceof Error
                        ? subscribeMutation.error.message
                        : "Something went wrong. Please try again."}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base"
                    disabled={subscribeMutation.isPending}
                    data-testid="button-newsletter-subscribe"
                  >
                    {subscribeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Subscribing...</>
                    ) : (
                      "Subscribe to SolarpunkDigest"
                    )}
                  </Button>
                </form>
              </Form>

              <p className="text-xs text-gray-500 mt-3 text-center">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* What you'll get */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-10">
          What's inside every issue
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            {
              icon: Zap,
              title: "⚡ Frontier Discoveries",
              desc: "Top-rated breakthroughs automatically starred — the most novel tech of the week.",
            },
            {
              icon: Sun,
              title: "TRL Ratings",
              desc: "Every item gets a Technology Readiness Level from 1 (lab paper) to 9 (proven deployment).",
            },
            {
              icon: TreePine,
              title: "10 Tech Categories",
              desc: "Solar microgrids, wind, rainwater, edge AI, permaculture, batteries, mesh nets, drones & more.",
            },
            {
              icon: Radio,
              title: "Human-Curated",
              desc: "AI researches daily. A human curates the best items into a weekly digest worth reading.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="p-5 rounded-xl border border-border/60 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground">
              ← Back to SolarpunkList
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
