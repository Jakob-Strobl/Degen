// TODO refactor ErrorCode
export enum ErrorCode {
    ERROR                       = -1,
    PAGE_HEADER_UNDEFINED       = 1,
    PAGE_HEADER_MISCONFIGURED   = 2,
    PAGE_HEADER_KEY_VALUE_DNE   = 3,
}

export interface ProjectConfig {
    settings: Settings;
    pages: PageTypes;
}
    
export interface Settings {
    degen: DegenSettings;
    pages: PageSettings;
    passthrough: StringIndexableObject<string>;
}

export interface DegenSettings {
    printTomlHeaderWarnings: boolean;
}

export interface PageSettings {
    source_path: string;
    export_path: string;
}

export interface PageTypes {
    [key: string]: StringIndexableObject<any>; // Custom PageTypes 
}

export interface StringIndexableObject<T> {
    [key: string]: T;
}

