/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TriageData {
  cleaningDate: string; // '<7' | '15-30' | '>30'
  rooms: number;
  baths: number;
  floors: number;
  marble: boolean;
  wood: boolean;
  doubleGlass: boolean;
  chandeliers: boolean;
  frequency: 'monthly' | 'individual' | '';
}

export interface AddonService {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
}

export type ApplicationScreen = 'welcome' | 'triage' | 'pricing' | 'recruitment' | 'minha-area' | 'admin';
