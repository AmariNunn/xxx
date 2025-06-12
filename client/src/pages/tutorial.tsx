import { Card, CardContent } from "@/components/ui/card";
import { Play, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Tutorial() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
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
        <Card className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-xl">
          <CardContent className="p-8">
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
              {/* Video Player */}
              <video 
                controls 
                className="w-full h-full object-cover"
                poster="/api/placeholder/800/450"
              >
                <source src="https://example.com/sky-iq-tutorial.mp4" type="video/mp4" />
                <source src="https://example.com/sky-iq-tutorial.webm" type="video/webm" />
                Your browser does not support the video tag.
              </video>
              
              {/* Fallback for when video doesn't load */}
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <Play className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                  <h3 className="text-xl font-semibold mb-2">Sky IQ Dashboard Tutorial</h3>
                  <p className="text-gray-300">
                    Video tutorial will be available here
                  </p>
                </div>
              </div>
            </div>

            {/* Video Description */}
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                What you'll learn:
              </h2>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  How to navigate the Sky IQ dashboard
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Setting up your business profile and preferences
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Viewing and analyzing call data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Managing leads and contact information
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Understanding call analytics and reports
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Integrating with Railway AI for automated responses
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/dashboard">
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                  Start Using Dashboard
                </Button>
              </Link>
              <Link href="/business-profile">
                <Button variant="outline" className="w-full sm:w-auto">
                  Set Up Business Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Additional Help Section */}
        <div className="max-w-4xl mx-auto mt-8">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Need Additional Help?
              </h3>
              <p className="text-blue-700 dark:text-blue-200 mb-4">
                If you have questions not covered in this tutorial, our support team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  Contact Support
                </Button>
                <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  View Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}