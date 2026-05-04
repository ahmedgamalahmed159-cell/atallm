/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subject, Tip, Term } from './types';

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: '1', name: 'Marketing', nameAr: 'التسويق', color: '#EF4444', icon: 'Target' },
  { id: '2', name: 'Accounting', nameAr: 'المحاسبة', color: '#3B82F6', icon: 'Calculator' },
  { id: '3', name: 'Business', nameAr: 'الأعمال', color: '#10B981', icon: 'Building2' },
  { id: '4', name: 'Management', nameAr: 'الإدارة', color: '#8B5CF6', icon: 'TrendingUp' },
];

export const DEFAULT_TIPS: Tip[] = [
  { 
    id: '1', 
    title: 'أساسيات التعلم الفعال', 
    content: 'راجع المادة بعد المحاضرة بـ 24 ساعة لتثبيت المعلومات. استخدم تقنية فينمان للشرح.', 
    icon: 'Book', 
    date: '2024-01-15', 
    isNew: true 
  },
  { 
    id: '2', 
    title: 'إدارة الوقت للطلاب', 
    content: 'خصص 25 دقيقة كاملة للمذاكرة ثم استرح 5 دقائق (تقنية البومودورو).', 
    icon: 'Clock', 
    date: '2024-01-10' 
  },
];

export const DEFAULT_TERMS: Term[] = [
  { id: '1', term: 'ROI', definition: 'Return on Investment - العائد على الاستثمار', category: 'Finance', example: 'The ROI for this campaign was 150%.' },
  { id: '2', term: 'B2B', definition: 'Business to Business - تجارة بين الشركات', category: 'Marketing', example: 'We are a B2B software company.' },
];
