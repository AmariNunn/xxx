import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import SkyIQText from "@/components/skyiq-text";

export default function Tutorial() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Floating Sky IQ Logo */}
      <div className="absolute top-8 right-8 z-10">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <SkyIQText className="text-2xl font-bold text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Sky IQ Dashboard Tutorial
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Learn how to use your Sky IQ dashboard effectively
              </p>
            </div>
          </div>
        </div>

        {/* Video Section */}
        <Card className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="aspect-video rounded-xl overflow-hidden shadow-inner bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
              <iframe 
                src="https://drive.google.com/file/d/1sJx0geBZgR2XPmZGcZ30Xhm_ayjbC8ee/preview"
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Sky IQ Dashboard Tutorial"
              />
            </div>

            {/* Video Description */}
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                Master Your Sky IQ Dashboard
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-center text-lg leading-relaxed">
                Watch this comprehensive tutorial to learn how to navigate and maximize your Sky IQ dashboard experience.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}