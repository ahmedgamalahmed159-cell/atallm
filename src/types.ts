/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Subject {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  icon: string;
}

export interface Lecture {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  subjectId: string;
  date: string;
}

export interface StudyFile {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: 'pdf' | 'doc' | 'xls' | 'ppt' | 'other';
  subjectId: string;
  date: string;
}

export interface Tip {
  id: string;
  title: string;
  content: string;
  icon: string;
  date: string;
  isNew?: boolean;
}

export interface Term {
  id: string;
  term: string;
  definition: string;
  category: string;
  example?: string;
}

export interface SiteUpdate {
  id: string;
  title: string;
  description: string;
  type: 'lecture' | 'file' | 'announcement';
  date: string;
  isNew?: boolean;
}

export interface UserProgress {
  id: string; // userId_itemId
  userId: string;
  itemId: string;
  itemType: 'lecture' | 'file';
  completed: boolean;
  updatedAt: any;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  createdAt: any;
}
