"use client";

import React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  maxStars?: number;
  disabled?: boolean;
}

const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  maxStars = 5,
  disabled = false,
}) => {
  const stars = Array.from({ length: maxStars }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-1">
      {stars.map((starValue) => (
        <Star
          key={starValue}
          className={cn(
            "h-5 w-5 cursor-pointer transition-colors",
            starValue <= value ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted-foreground",
            disabled ? "cursor-not-allowed opacity-70" : "hover:fill-yellow-300 hover:text-yellow-300"
          )}
          onClick={() => !disabled && onChange(starValue)}
        />
      ))}
    </div>
  );
};

export default StarRatingInput;