import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import SkyIQText from "@/components/skyiq-text";

export default function Tutorial() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Floating Sky IQ Logo */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-2 md:px-4 md:py-2 shadow-lg">
          <SkyIQText className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Create your Dashboard
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400 break-words">
                Sky IQ Dashboard Tutorial
              </h1>
              <p className="text-blue-500 dark:text-blue-300 mt-2 text-sm md:text-base break-words">
                Learn how to use your Sky IQ dashboard effectively
              </p>
            </div>
          </div>
        </div>

        {/* Video Section */}
        <Card className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-2xl border-0">
          <CardContent className="p-4 md:p-8">
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
            <div className="mt-6 md:mt-8">
              <h2 className="text-xl md:text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4 text-center break-words">
                Master Your Sky IQ Dashboard
              </h2>
              <p className="text-blue-500 dark:text-blue-300 text-center text-base md:text-lg leading-relaxed break-words px-2">
                Watch this comprehensive tutorial to learn how to navigate and maximize your Sky IQ dashboard experience.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}