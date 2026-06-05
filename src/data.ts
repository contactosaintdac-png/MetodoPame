/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AddonService } from './types';

export const PAME_ADDONS: AddonService[] = [
  {
    id: 'dobra',
    name: 'Organização de Roupas',
    price: 50,
    icon: 'dry_cleaning',
    description: 'Organização e arrumação de roupas nos armários e gavetas.'
  },
  {
    id: 'passadoria',
    name: 'Passadoria de Roupas',
    price: 50,
    icon: 'iron',
    description: 'Passadoria de roupas em geral, incluindo peças delicadas.'
  },
  {
    id: 'loucas',
    name: 'Limpeza de Louças',
    price: 50,
    icon: 'wine_bar',
    description: 'Lavagem e secagem cuidadosa de louças finas e taças.'
  },
  {
    id: 'eletros',
    name: 'Limpeza Interna de Eletrodomésticos',
    price: 50,
    icon: 'kitchen',
    description: 'Limpeza profunda do interior de geladeiras, fornos e micro-ondas.'
  },
  {
    id: 'polimento',
    name: 'Polimento de Metais',
    price: 50,
    icon: 'flare',
    description: 'Limpeza e polimento de torneiras e objetos metálicos.'
  },
  {
    id: 'closets',
    name: 'Organização de Closets',
    price: 50,
    icon: 'checkroom',
    description: 'Reorganização completa de closets e sapatos.'
  },
  {
    id: 'vidros',
    name: 'Limpeza de Vidros',
    price: 50,
    icon: 'window',
    description: 'Limpeza de janelas, espelhos e box de banheiros.'
  },
  {
    id: 'despensa',
    name: 'Organização de Despensa',
    price: 50,
    icon: 'kitchen',
    description: 'Reorganização completa e higienização de despensas e armários de mantimentos.'
  }
];

export const INITIAL_TRIAGE_DATA = {
  cleaningDate: '<7',
  rooms: 3,
  baths: 2,
  floors: 1,
  marble: false,
  wood: false,
  doubleGlass: false,
  chandeliers: false,
  frequency: '' as const
};
