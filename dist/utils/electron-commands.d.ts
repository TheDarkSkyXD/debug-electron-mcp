/**
 * Enhanced Electron interaction commands for React-based applications
 * Addresses common issues with form interactions, event handling, and state management
 */
export interface ElementAnalysis {
    element?: Element;
    tag: string;
    text: string;
    id: string;
    className: string;
    name: string;
    placeholder: string;
    type: string;
    value: string;
    ariaLabel: string;
    ariaRole: string;
    title: string;
    href: string;
    src: string;
    alt: string;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    isVisible: boolean;
    isInteractive: boolean;
    zIndex: number;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontWeight: string;
    cursor: string;
    context: string;
    selector: string;
    xpath: string;
}
export interface PageAnalysis {
    clickable: ElementAnalysis[];
    inputs: ElementAnalysis[];
    links: ElementAnalysis[];
    images: ElementAnalysis[];
    text: ElementAnalysis[];
    containers: ElementAnalysis[];
    metadata: {
        totalElements: number;
        visibleElements: number;
        interactiveElements: number;
        pageTitle: string;
        pageUrl: string;
        viewport: {
            width: number;
            height: number;
        };
    };
}
/**
 * Generate the enhanced find_elements command with deep DOM analysis
 */
export declare function generateFindElementsCommand(): string;
/**
 * Generate the enhanced click_by_text command with improved element scoring
 */
export declare function generateClickByTextCommand(text: string): string;
