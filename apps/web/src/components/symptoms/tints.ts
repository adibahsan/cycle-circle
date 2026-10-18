'use client';

import { createContext } from 'react';
import type { CardTint } from '@/components/ui/tints';

/** The tint of the category card a chip sits on; chips outside a category card use pink. */
export const SymptomTintContext = createContext<CardTint>('pink');
