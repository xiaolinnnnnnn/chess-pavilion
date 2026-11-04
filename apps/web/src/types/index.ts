export interface GameSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface GameSettingField {
  key: string;
  label: string;
  type: 'select' | 'switch' | 'number';
  options?: GameSettingOption[];
  default: string | number | boolean;
  min?: number;
  max?: number;
  help?: string;
}

export interface GameConfig {
  name: string;
  minSize: number;
  maxSize: number;
  description: string;
  table?: 'grid' | 'board' | 'cards' | 'custom';
  ai?: 'client' | 'none';
  settings?: GameSettingField[];
  requireAllReadyToStart?: boolean;
}

export interface Message {
  type: string;
  data: any;
  sender?: any;
}

export interface Command {
  type: string;
  data?: any;
}
