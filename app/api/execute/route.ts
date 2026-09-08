import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { language, code } = body;

        // Normalize input to lowercase to prevent case-mismatch bugs
        const lang = (language || '').toLowerCase();

        let compilerId = 'nodejs'; // Default fallback

        if (lang === 'javascript' || lang === 'js') {
            compilerId = 'nodejs';
        } else if (lang === 'csharp' || lang === 'cs' || lang === 'c#') {
            compilerId = 'dotnet-csharp-9'; // Official C# .NET 9 engine identifier
        } else if (lang === 'java') {
            compilerId = 'openjdk-25';
        } else if (lang === 'python') {
            compilerId = 'python-3.14';
        } else if (lang === 'c') {
            compilerId = 'gcc-15';
        } else if (lang === 'cpp') {
            compilerId = 'g++-15';
        } else if (lang === 'rust' || lang === 'rs') {
            compilerId = 'rust-1.93';
        }

        // Forward payload to the online execution provider using official endpoints
        const response = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${process.env.ONLINE_COMPILER_API_KEY || ''}`,
            },
            body: JSON.stringify({
                compiler: compilerId,
                code: code,
            }),
        });

        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Execution API Route Error:', error);
        return NextResponse.json(
            { error: 'Internal server error during code execution.' },
            { status: 500 }
        );
    }
}