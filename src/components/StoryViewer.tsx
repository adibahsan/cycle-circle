import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

export interface Story {
    id: string;
    imageUrl: string;
    title: string;
    content: string;
}

interface StoryViewerProps {
    stories: Story[];
    category: string;
    onClose: () => void;
    durationMs?: number;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
    stories,
    category,
    onClose,
    durationMs = 5000,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const isPaused = useRef(false);
    const lastTimeRef = useRef<number>(0);
    const accumulatedTimeRef = useRef<number>(0);
    const requestRef = useRef<number>();

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Animation Loop
    const animate = (time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;

        if (!isPaused.current) {
            accumulatedTimeRef.current += deltaTime;
            const newProgress = Math.min((accumulatedTimeRef.current / durationMs) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                // Auto-advance
                if (currentIndex < stories.length - 1) {
                    setCurrentIndex(prev => prev + 1);
                    accumulatedTimeRef.current = 0;
                    setProgress(0);
                } else {
                    onClose(); // End of stories
                }
            }
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        // Reset timers on index change
        accumulatedTimeRef.current = 0;
        setProgress(0);
        lastTimeRef.current = 0; // force reset
        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [currentIndex, durationMs]);

    const handleNext = () => {
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            // Replay current if it's the first one
            accumulatedTimeRef.current = 0;
            setProgress(0);
        }
    };

    const currentStory = stories[currentIndex];

    // Pause on long press (touch devices) or mouse down
    const handlePointerDown = () => { isPaused.current = true; };
    const handlePointerUp = () => {
        isPaused.current = false;
        lastTimeRef.current = performance.now(); // Avoid jumping due to pause
    };

    if (!currentStory) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black flex justify-center items-center touch-none">
            {/* Aspect ratio container (mimics phone screen) */}
            <div
                className="relative w-full h-full max-w-md bg-zinc-900 shadow-2xl overflow-hidden pointer-events-auto select-none"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* Background Image */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${currentStory.imageUrl}')` }}
                />

                {/* Dark Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />

                {/* Top UI Area: Progress Bars & Header */}
                <div className="absolute top-0 left-0 right-0 p-4 pt-safe z-20 pointer-events-none">
                    {/* Progress Bars */}
                    <div className="flex gap-1.5 mb-4">
                        {stories.map((_, i) => {
                            let barProgress = 0;
                            if (i < currentIndex) barProgress = 100;
                            else if (i === currentIndex) barProgress = progress;
                            return (
                                <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="h-full bg-white rounded-full"
                                        style={{ width: `${barProgress}%` }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Header: Category & Close / Pause icon */}
                    <div className="flex justify-between items-center text-white drop-shadow-md">
                        <div className="flex items-center gap-2">
                            <img src="https://flo.health/images/flo.svg" alt="Flo Logo" className="h-5 w-auto drop-shadow-sm" />
                            <span className="font-bold text-sm tracking-wide uppercase">{category}</span>
                            <span className="text-white/70 text-xs">• Just now</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md pointer-events-auto"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Area (Bottom) */}
                <div className="absolute bottom-10 left-0 right-0 p-6 z-20 pointer-events-none drop-shadow-lg">
                    <h2 className="text-white font-extrabold text-3xl mb-3 leading-tight">
                        {currentStory.title}
                    </h2>
                    <p className="text-white/90 text-sm leading-relaxed max-w-[90%] font-medium">
                        {currentStory.content}
                    </p>
                </div>

                {/* Invisible Tap Zones for Navigation */}
                <div className="absolute inset-0 z-10 flex cursor-pointer">
                    <div className="w-1/3 h-full" onClick={handlePrev} />
                    <div className="w-2/3 h-full" onClick={handleNext} />
                </div>
            </div>
        </div>
    );
};
