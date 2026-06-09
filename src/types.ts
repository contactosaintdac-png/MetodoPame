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

export interface Employee {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  cpf?: string;
  role: 'Especialista' | 'Admin' | string;
  zones?: string;
  status: 'pending' | 'active' | 'inactive';
  active: boolean;
  photoURL?: string;
  weeklyAvailability?: string[][]; // Array of arrays containing shifts
  createdAt?: string;
}

export interface Review {
  stars: number;
  text: string;
  date?: string;
}

export interface Booking {
  id?: string;
  docId?: string;
  name?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  date: string;
  time?: string;
  shift?: string;
  format?: 'meio' | 'completo';
  modality?: string;
  status: 'Confirmado' | 'Concluído' | 'Cancelado' | 'Pendente';
  totalPrice: number;
  addons?: string[];
  assignedEmployeeId?: string;
  employeeName?: string;
  createdAt?: string;
  review?: Review;
}
