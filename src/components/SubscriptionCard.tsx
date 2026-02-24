"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, Zap } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { purchasePro } from "@/utils/billing";
import { Skeleton } from "@/components/ui/skeleton";

const SubscriptionCard: React.FC = () => {
  const { isPro, isLoading, product } = useBilling();

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card className={isPro ? "border-primary bg-primary/5" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className={isPro ? "text-primary fill-primary" : "text-muted-foreground"} />
            Subscription Status
          </CardTitle>
          {isPro ? (
            <Badge className="bg-primary text-primary-foreground">PRO ACTIVE</Badge>
          ) : (
            <Badge variant="outline">FREE VERSION</Badge>
          )}
        </div>
        <CardDescription>
          {isPro 
            ? "You have full access to all premium features." 
            : "Upgrade to Pro to unlock advanced statistics and unlimited students."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isPro && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Advanced Test Statistics & Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Unlimited Student Records</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Priority Support</span>
            </div>
            
            <Button onClick={purchasePro} className="w-full mt-4 gap-2">
              <Star className="h-4 w-4 fill-current" />
              Upgrade to Pro {product?.pricing?.price ? `for ${product.pricing.price}/mo` : ""}
            </Button>
          </div>
        )}
        
        {isPro && (
          <div className="text-sm text-muted-foreground">
            Thank you for supporting HDT Instructor! Your subscription is managed through the Google Play Store.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionCard;