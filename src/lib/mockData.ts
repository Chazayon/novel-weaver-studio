// Novel Studio Mock Data & Types

export interface Project {
  id: string;
  title: string;
  author: string;
  genre: string;
  seriesLength: number;
  createdAt: Date;
  updatedAt: Date;
  currentPhase: number;
  progress: number;
}

export interface Phase {
  id: number;
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed';
  duration: string;
  outputs: string[];
  requiredInputs: string[];
}

export interface Artifact {
  id: string;
  name: string;
  type: 'outline' | 'characters' | 'worldbuilding' | 'style' | 'chapter' | 'other';
  content: string;
  updatedAt: Date;
  pinned: boolean;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  sceneBrief: 'not-started' | 'completed';
  draft: 'not-started' | 'in-progress' | 'completed';
  improvePlan: 'not-started' | 'completed';
  final: 'not-started' | 'completed';
  wordCount: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt?: Date;
  completedAt?: Date;
}

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: '1',
    title: 'The Forgotten Kingdom',
    author: 'Jane Doe',
    genre: 'Fantasy',
    seriesLength: 24,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    currentPhase: 6,
    progress: 65,
  },
  {
    id: '2',
    title: 'Midnight Protocol',
    author: 'Jane Doe',
    genre: 'Sci-Fi Thriller',
    seriesLength: 18,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
    currentPhase: 4,
    progress: 40,
  },
  {
    id: '3',
    title: 'Whispers of the Heart',
    author: 'Jane Doe',
    genre: 'Romance',
    seriesLength: 20,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-12'),
    currentPhase: 2,
    progress: 15,
  },
];

// Mock Phases
export const mockPhases: Phase[] = [
  {
    id: 1,
    name: 'Initial Setup & Research',
    description: 'Analyze genre tropes and establish your writing style sheet.',
    status: 'completed',
    duration: '5-10 minutes',
    outputs: ['genre_tropes.md', 'style_sheet.md'],
    requiredInputs: ['Genre', 'Target audience', 'Tone preferences'],
  },
  {
    id: 2,
    name: 'Brainstorming & Series Outline',
    description: 'Interactive brainstorming session to develop your series outline.',
    status: 'completed',
    duration: '15-30 minutes',
    outputs: ['series_outline.md'],
    requiredInputs: ['Core concept', 'Main themes', 'Story beats'],
  },
  {
    id: 3,
    name: 'Call Sheet Generation',
    description: 'Generate a comprehensive call sheet for your novel production.',
    status: 'completed',
    duration: '5-10 minutes',
    outputs: ['call_sheet.md'],
    requiredInputs: ['Series outline'],
  },
  {
    id: 4,
    name: 'Characters & Worldbuilding',
    description: 'Develop deep character profiles and rich world details.',
    status: 'completed',
    duration: '10-20 minutes',
    outputs: ['characters.md', 'worldbuilding.md'],
    requiredInputs: ['Call sheet', 'Genre tropes'],
  },
  {
    id: 5,
    name: 'Chapter Outline Creation',
    description: 'Create detailed chapter-by-chapter outline for your novel.',
    status: 'completed',
    duration: '10-15 minutes',
    outputs: ['outline.md'],
    requiredInputs: ['Series outline', 'Characters', 'Worldbuilding'],
  },
  {
    id: 6,
    name: 'Chapter Writing',
    description: 'Write each chapter through the scene brief → draft → improve → final pipeline.',
    status: 'in-progress',
    duration: '15-25 min/chapter',
    outputs: ['chapter_X_final.md'],
    requiredInputs: ['Outline', 'Characters', 'Style sheet', 'Previous chapter'],
  },
  {
    id: 7,
    name: 'Final Compilation',
    description: 'Compile all chapters into the final manuscript.',
    status: 'not-started',
    duration: '5 minutes',
    outputs: ['FINAL_MANUSCRIPT.md'],
    requiredInputs: ['All chapters finalized'],
  },
];

// Mock Chapters
export const mockChapters: Chapter[] = [
  { id: '1', number: 1, title: 'The Awakening', sceneBrief: 'completed', draft: 'completed', improvePlan: 'completed', final: 'completed', wordCount: 3250 },
  { id: '2', number: 2, title: 'Into the Unknown', sceneBrief: 'completed', draft: 'completed', improvePlan: 'completed', final: 'completed', wordCount: 2980 },
  { id: '3', number: 3, title: 'The First Trial', sceneBrief: 'completed', draft: 'completed', improvePlan: 'completed', final: 'completed', wordCount: 3100 },
  { id: '4', number: 4, title: 'Shadows Rising', sceneBrief: 'completed', draft: 'completed', improvePlan: 'not-started', final: 'not-started', wordCount: 2850 },
  { id: '5', number: 5, title: 'Alliance Formed', sceneBrief: 'completed', draft: 'in-progress', improvePlan: 'not-started', final: 'not-started', wordCount: 1200 },
  { id: '6', number: 6, title: 'The Hidden Truth', sceneBrief: 'not-started', draft: 'not-started', improvePlan: 'not-started', final: 'not-started', wordCount: 0 },
  { id: '7', number: 7, title: 'Crossroads', sceneBrief: 'not-started', draft: 'not-started', improvePlan: 'not-started', final: 'not-started', wordCount: 0 },
  { id: '8', number: 8, title: 'The Dark Descent', sceneBrief: 'not-started', draft: 'not-started', improvePlan: 'not-started', final: 'not-started', wordCount: 0 },
];

// Mock Artifacts
export const mockArtifacts: Artifact[] = [
  {
    id: '1',
    name: 'Series Outline',
    type: 'outline',
    content: '# The Forgotten Kingdom - Series Outline\n\n## Act I: The Awakening...',
    updatedAt: new Date('2024-01-18'),
    pinned: true,
  },
  {
    id: '2',
    name: 'Character Profiles',
    type: 'characters',
    content: '# Main Characters\n\n## Elena Thornwood\nAge: 24...',
    updatedAt: new Date('2024-01-17'),
    pinned: true,
  },
  {
    id: '3',
    name: 'Worldbuilding Bible',
    type: 'worldbuilding',
    content: '# The Realm of Aethoria\n\n## Geography...',
    updatedAt: new Date('2024-01-17'),
    pinned: true,
  },
  {
    id: '4',
    name: 'Style Sheet',
    type: 'style',
    content: '# Writing Style Guide\n\n## Voice: Third person limited...',
    updatedAt: new Date('2024-01-15'),
    pinned: true,
  },
  {
    id: '5',
    name: 'Chapter 3 - Final',
    type: 'chapter',
    content: '# Chapter 3: The First Trial\n\nElena stood at the edge...',
    updatedAt: new Date('2024-01-20'),
    pinned: false,
  },
];

// Placeholder API functions
export const api = {
  async getProjects(): Promise<Project[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockProjects), 500));
  },
  
  async getProject(id: string): Promise<Project | undefined> {
    return new Promise((resolve) => 
      setTimeout(() => resolve(mockProjects.find(p => p.id === id)), 300)
    );
  },
  
  async createProject(data: Partial<Project>): Promise<Project> {
    const newProject: Project = {
      id: String(Date.now()),
      title: data.title || 'Untitled',
      author: data.author || 'Unknown',
      genre: data.genre || 'Fiction',
      seriesLength: data.seriesLength || 20,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentPhase: 1,
      progress: 0,
    };
    return new Promise((resolve) => setTimeout(() => resolve(newProject), 300));
  },
  
  async getPhases(): Promise<Phase[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockPhases), 300));
  },
  
  async getChapters(): Promise<Chapter[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockChapters), 300));
  },
  
  async getArtifacts(): Promise<Artifact[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockArtifacts), 300));
  },
  
  async runPhase(phaseId: number): Promise<{ success: boolean }> {
    return new Promise((resolve) => 
      setTimeout(() => resolve({ success: true }), 2000)
    );
  },
  
  async runChapterStep(chapterId: string, step: string): Promise<{ success: boolean }> {
    return new Promise((resolve) => 
      setTimeout(() => resolve({ success: true }), 3000)
    );
  },
};
