/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Guardian {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface Student {
  id: string;
  name: string;
  className: string;
  guardians: Guardian[];
  createdAt: number;
}

export const CLASSES = [
  "Berçário I",
  "Berçário II",
  "Maternal I",
  "Maternal II",
  "Pré-Escola I",
  "Pré-Escola II"
];
