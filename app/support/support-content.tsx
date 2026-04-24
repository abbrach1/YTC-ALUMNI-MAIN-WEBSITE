"use client"

import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, BookOpen, Users, Building } from "lucide-react"

export default function SupportContent() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-12 text-center">
            <div className="mx-auto mb-4 h-1 w-24 bg-gold" aria-hidden="true" />
            <h1 className="font-serif text-5xl font-bold text-navy mb-4">Support the Yeshiva</h1>
            <p className="text-lg text-navy/70 max-w-2xl mx-auto">Help sustain Torah learning for future generations</p>
          </header>

          {/* Hero Card */}
          <Card className="mb-12 border-gold/20 bg-white shadow-xl">
            <CardContent className="py-12">
              <div className="mx-auto max-w-3xl text-center">
                <Heart className="mx-auto h-16 w-16 text-gold mb-6" aria-hidden="true" />
                <h2 className="font-serif text-3xl font-bold text-navy mb-4">
                  Your Support Makes Torah Learning Possible
                </h2>
                <p className="text-lg text-navy/80 leading-relaxed mb-8">
                  Yeshiva Toras Chaim relies on the generous support of our alumni and friends to provide the highest
                  level of Torah education. Every contribution, no matter the size, helps sustain our mission of
                  developing Talmidei Chachamim and bnei Torah.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button size="lg" className="bg-gold text-navy hover:bg-gold/90 font-semibold text-lg">
                    Monthly Donation – Coming Soon
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-gold text-navy hover:bg-gold/10 font-semibold text-lg bg-transparent"
                  >
                    One-Time Gift – Coming Soon
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Impact Areas */}
          <section className="mb-12" aria-labelledby="impact-heading">
            <h2 id="impact-heading" className="font-serif text-3xl font-bold text-navy mb-8 text-center">
              Your Impact
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy/10">
                    <BookOpen className="h-6 w-6 text-navy" aria-hidden="true" />
                  </div>
                  <CardTitle className="font-serif text-xl text-navy">Torah Learning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed">
                    Support daily shiurim, seforim, and learning resources that enable our talmidim to grow in Torah
                    knowledge and yiras shamayim.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy/10">
                    <Users className="h-6 w-6 text-navy" aria-hidden="true" />
                  </div>
                  <CardTitle className="font-serif text-xl text-navy">Student Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed">
                    Help provide scholarships, stipends, and assistance to talmidim who dedicate themselves to full-time
                    learning.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy/10">
                    <Building className="h-6 w-6 text-navy" aria-hidden="true" />
                  </div>
                  <CardTitle className="font-serif text-xl text-navy">Facilities & Programs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed">
                    Maintain our Bais Medrash, fund special programs, and ensure a conducive environment for Torah
                    growth.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Monthly Alumni Support */}
          <Card className="mb-12 border-gold/20 bg-gradient-to-br from-navy to-navy/90 text-cream shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif text-3xl text-gold">Join the Alumni Monthly Support Circle</CardTitle>
              <CardDescription className="text-cream/80 text-lg">
                Become a sustaining partner in the Yeshiva's mission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-cream/90 leading-relaxed mb-6">
                Our monthly alumni support program allows you to make a consistent, meaningful impact on the Yeshiva.
                Choose an amount that works for you, and your ongoing contribution will help ensure the continuity of
                limud haTorah for years to come.
              </p>
              <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <div className="rounded-lg border border-gold/30 bg-cream/10 p-4 text-center">
                  <p className="text-2xl font-bold text-gold">$18</p>
                  <p className="text-sm text-cream/70">per month</p>
                </div>
                <div className="rounded-lg border border-gold/30 bg-cream/10 p-4 text-center">
                  <p className="text-2xl font-bold text-gold">$36</p>
                  <p className="text-sm text-cream/70">per month</p>
                </div>
                <div className="rounded-lg border border-gold/30 bg-cream/10 p-4 text-center">
                  <p className="text-2xl font-bold text-gold">Custom</p>
                  <p className="text-sm text-cream/70">amount</p>
                </div>
              </div>
              <Button size="lg" className="w-full bg-gold text-navy hover:bg-gold/90 font-semibold">
                Set Up Monthly Donation – Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Other Ways to Give */}
          <section aria-labelledby="other-ways-heading">
            <h2 id="other-ways-heading" className="font-serif text-3xl font-bold text-navy mb-8 text-center">
              Other Ways to Support
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-navy">Dedicated Learning</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed mb-4">
                    Sponsor a day, week, or month of learning in memory of a loved one or in honor of a special
                    occasion.
                  </p>
                  <p className="text-sm text-navy/50">Contact the Yeshiva office for more information</p>
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-navy">Seforim & Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed mb-4">
                    Donate seforim to our Bais Medrash or sponsor the purchase of new learning materials and resources.
                  </p>
                  <p className="text-sm text-navy/50">Contact the Yeshiva office for more information</p>
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-navy">Legacy Giving</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed mb-4">
                    Include Yeshiva Toras Chaim in your estate planning to ensure your support continues for
                    generations.
                  </p>
                  <p className="text-sm text-navy/50">Contact the Yeshiva office for more information</p>
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-navy">Matching Gifts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-navy/70 leading-relaxed mb-4">
                    Many employers match charitable donations. Check if your company participates to double your impact.
                  </p>
                  <p className="text-sm text-navy/50">Contact the Yeshiva office for more information</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Thank You Message */}
          <Card className="mt-12 border-gold/20 bg-gold/10 shadow-lg">
            <CardContent className="py-8 text-center">
              <p className="font-serif text-2xl text-navy mb-2" lang="he">
                תזכו למצוות
              </p>
              <p className="text-navy/70">
                Thank you for your support and partnership in the holy work of limud haTorah
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  )
}
