import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';
export declare function handleToolCall(request: z.infer<typeof CallToolRequestSchema>): Promise<{
    content: any[];
    isError: boolean;
}>;
