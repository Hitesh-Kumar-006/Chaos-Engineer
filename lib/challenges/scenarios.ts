/**
 * Multi-scenario challenge pool for Auto Chaos mode.
 * 4 distinct coding challenges × 6 languages = 24 scenarios.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChallengeInfo {
  title: string;
  description: string;
  requirements: string[];
  starterCode: string;
}

export type SnippetLang = "javascript" | "python" | "java" | "c" | "cpp" | "csharp";

/* ------------------------------------------------------------------ */
/*  JavaScript                                                         */
/* ------------------------------------------------------------------ */

const javascript: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a function that parses a raw CSV data stream into structured record objects. The input may contain missing values ('null', empty strings, or '---'), malformed rows with wrong column counts, and unexpected whitespace. Your parser must handle every anomaly gracefully without crashing.",
    requirements: [
      "Split input by newline and parse each row as comma-separated values",
      "Replace missing values with 0 for numbers and 'unknown' for strings",
      "Log a warning for each malformed row that is skipped",
      "Return an array of valid, cleaned record objects",
    ],
    starterCode:
      "// Challenge: Resilient Data Stream Parser\n\nfunction parseDataStream(raw) {\n    // Your implementation here\n}\n\nconst rawInput = \"id,name,score\\n1,Alice,92\\n2,Bob,null\\n3,,,\\nmalformed_row\\n4,Charlie,85\";\nconst result = parseDataStream(rawInput);\nconsole.log(\"Parsed records:\", JSON.stringify(result));",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a generic retry utility that wraps an unreliable operation and retries it on failure using exponential backoff with jitter. After exhausting all retries the function must throw the last error encountered.",
    requirements: [
      "Accept a callback, maxRetries count, and baseDelay in milliseconds",
      "Wait baseDelay * 2^attempt + random jitter between each retry",
      "Log each retry attempt number and the error message",
      "Throw the last error after all retries are exhausted",
    ],
    starterCode:
      "// Challenge: Retry with Exponential Backoff\n\nfunction withRetry(fn, maxRetries, baseDelay) {\n    // Your implementation here\n}\n\nlet attempt = 0;\nconst unreliableApi = () => {\n    attempt++;\n    if (attempt < 3) throw new Error(\"Service unavailable\");\n    return { status: \"ok\", data: [1, 2, 3] };\n};\n\ntry {\n    const result = withRetry(unreliableApi, 5, 100);\n    console.log(\"Success:\", result);\n} catch (e) {\n    console.error(\"Failed after retries:\", e.message);\n}",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a rate limiter using the Token Bucket algorithm. Requests consume one token; tokens refill at a fixed rate up to a maximum capacity. Excess requests beyond the available tokens must be rejected gracefully.",
    requirements: [
      "Accept maxTokens capacity and refillRate (tokens per second)",
      "Each call to allowRequest() consumes one token if available",
      "Tokens refill continuously based on elapsed time since last check",
      "Return true when the request is allowed, false when rejected",
    ],
    starterCode:
      "// Challenge: Token Bucket Rate Limiter\n\nclass RateLimiter {\n    constructor(maxTokens, refillRate) {\n        // Your implementation here\n    }\n    allowRequest() {\n        // Your implementation here\n    }\n}\n\nconst limiter = new RateLimiter(5, 2);\nfor (let i = 0; i < 10; i++) {\n    console.log(`Request ${i + 1}: ${limiter.allowRequest() ? \"ALLOWED\" : \"REJECTED\"}`);\n}",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks a settings object against a schema definition. It must detect missing required keys, type mismatches, and out-of-range values, collecting all errors into a single report rather than throwing on the first failure.",
    requirements: [
      "Validate each key in the schema against the config object",
      "Check for required keys, correct types, and numeric min/max ranges",
      "Collect all validation errors into a single array (do not throw early)",
      "Return an object with { valid: boolean, errors: string[] }",
    ],
    starterCode:
      "// Challenge: Configuration Validator\n\nfunction validateConfig(config, schema) {\n    // Your implementation here\n}\n\nconst schema = [\n    { key: \"host\", type: \"string\", required: true },\n    { key: \"port\", type: \"number\", required: true, min: 1, max: 65535 },\n    { key: \"timeout\", type: \"number\", required: false, min: 0, max: 30000 },\n];\n\nconst config = { host: \"localhost\", port: 70000, timeout: -5 };\nconst result = validateConfig(config, schema);\nconsole.log(JSON.stringify(result));",
  },
];

/* ------------------------------------------------------------------ */
/*  Python                                                             */
/* ------------------------------------------------------------------ */

const python: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a function that parses a raw CSV data stream into structured record dictionaries. The input may contain missing values ('None', empty strings, or '---'), malformed rows with wrong column counts, and unexpected whitespace. Your parser must handle every anomaly gracefully.",
    requirements: [
      "Split input by newline and parse each row as comma-separated values",
      "Replace missing values with 0 for numbers and 'unknown' for strings",
      "Log a warning for each malformed row that is skipped",
      "Return a list of valid, cleaned record dictionaries",
    ],
    starterCode:
      "# Challenge: Resilient Data Stream Parser\n\ndef parse_data_stream(raw: str) -> list:\n    # Your implementation here\n    pass\n\nraw_input = \"id,name,score\\n1,Alice,92\\n2,Bob,None\\n3,,,\\nmalformed_row\\n4,Charlie,85\"\nresult = parse_data_stream(raw_input)\nprint(f\"Parsed records: {result}\")",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a retry decorator that wraps an unreliable callable and retries it on exception using exponential backoff with jitter. After exhausting all retries it must re-raise the last exception.",
    requirements: [
      "Accept max_retries count and base_delay in seconds as parameters",
      "Wait base_delay * 2^attempt + random jitter between each retry",
      "Log each retry attempt number and the exception message",
      "Re-raise the last exception after all retries are exhausted",
    ],
    starterCode:
      "# Challenge: Retry with Exponential Backoff\nimport time\nimport random\n\ndef with_retry(fn, max_retries, base_delay):\n    # Your implementation here\n    pass\n\nattempt = 0\ndef unreliable_api():\n    global attempt\n    attempt += 1\n    if attempt < 3:\n        raise ConnectionError(\"Service unavailable\")\n    return {\"status\": \"ok\", \"data\": [1, 2, 3]}\n\ntry:\n    result = with_retry(unreliable_api, 5, 0.1)\n    print(f\"Success: {result}\")\nexcept Exception as e:\n    print(f\"Failed after retries: {e}\")",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a rate limiter class using the Token Bucket algorithm. Requests consume one token; tokens refill at a fixed rate up to a maximum capacity. Excess requests beyond the available tokens must be rejected.",
    requirements: [
      "Accept max_tokens capacity and refill_rate (tokens per second)",
      "Each call to allow_request() consumes one token if available",
      "Tokens refill continuously based on elapsed time since last check",
      "Return True when the request is allowed, False when rejected",
    ],
    starterCode:
      "# Challenge: Token Bucket Rate Limiter\nimport time\n\nclass RateLimiter:\n    def __init__(self, max_tokens, refill_rate):\n        # Your implementation here\n        pass\n\n    def allow_request(self):\n        # Your implementation here\n        pass\n\nlimiter = RateLimiter(5, 2)\nfor i in range(10):\n    status = \"ALLOWED\" if limiter.allow_request() else \"REJECTED\"\n    print(f\"Request {i + 1}: {status}\")",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks a settings dictionary against a schema definition. It must detect missing required keys, type mismatches, and out-of-range values, collecting all errors into a single report.",
    requirements: [
      "Validate each key in the schema against the config dictionary",
      "Check for required keys, correct types, and numeric min/max ranges",
      "Collect all validation errors into a single list (do not raise early)",
      "Return a dict with 'valid' (bool) and 'errors' (list of strings)",
    ],
    starterCode:
      "# Challenge: Configuration Validator\n\ndef validate_config(config: dict, schema: list) -> dict:\n    # Your implementation here\n    pass\n\nschema = [\n    {\"key\": \"host\", \"type\": \"string\", \"required\": True},\n    {\"key\": \"port\", \"type\": \"number\", \"required\": True, \"min\": 1, \"max\": 65535},\n    {\"key\": \"timeout\", \"type\": \"number\", \"required\": False, \"min\": 0, \"max\": 30000},\n]\n\nconfig = {\"host\": \"localhost\", \"port\": 70000, \"timeout\": -5}\nresult = validate_config(config, schema)\nprint(result)",
  },
];

/* ------------------------------------------------------------------ */
/*  Java                                                               */
/* ------------------------------------------------------------------ */

const java: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a method that parses a raw CSV data stream into structured record Maps. The input may contain missing values (empty strings or '---'), malformed rows, and unexpected delimiters. Your parser must handle each anomaly without throwing unhandled exceptions.",
    requirements: [
      "Split input by newline and parse each row as comma-separated values",
      "Replace missing numeric values with 0 and missing strings with 'unknown'",
      "Print a warning for each malformed row that is skipped",
      "Return a List of valid, cleaned record Maps",
    ],
    starterCode:
      "import java.util.*;\n\nclass Main {\n    static List<Map<String, String>> parseDataStream(String raw) {\n        // Your implementation here\n        return new ArrayList<>();\n    }\n\n    public static void main(String[] args) {\n        String rawInput = \"id,name,score\\n1,Alice,92\\n2,Bob,\\n3,,,\\nmalformed_row\\n4,Charlie,85\";\n        List<Map<String, String>> result = parseDataStream(rawInput);\n        System.out.println(\"Parsed records: \" + result);\n    }\n}",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a generic retry utility that wraps an unreliable operation and retries it on failure using exponential backoff with jitter. After exhausting all retries it must throw the last exception encountered.",
    requirements: [
      "Accept a Callable, maxRetries count, and baseDelay in milliseconds",
      "Wait baseDelay * 2^attempt + random jitter between each retry",
      "Print each retry attempt number and the exception message",
      "Throw the last exception after all retries are exhausted",
    ],
    starterCode:
      "import java.util.concurrent.Callable;\nimport java.util.Random;\n\nclass Main {\n    static <T> T withRetry(Callable<T> fn, int maxRetries, long baseDelay) throws Exception {\n        // Your implementation here\n        return null;\n    }\n\n    static int attempt = 0;\n\n    public static void main(String[] args) {\n        try {\n            String result = withRetry(() -> {\n                attempt++;\n                if (attempt < 3) throw new RuntimeException(\"Service unavailable\");\n                return \"OK\";\n            }, 5, 100);\n            System.out.println(\"Success: \" + result);\n        } catch (Exception e) {\n            System.err.println(\"Failed: \" + e.getMessage());\n        }\n    }\n}",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a thread-safe rate limiter using the Token Bucket algorithm. Requests consume one token; tokens refill at a fixed rate up to a maximum capacity. Excess requests must be rejected.",
    requirements: [
      "Accept maxTokens capacity and refillRate (tokens per second)",
      "Each call to allowRequest() consumes one token if available",
      "Tokens refill continuously based on elapsed time since last check",
      "Return true when the request is allowed, false when rejected",
    ],
    starterCode:
      "class RateLimiter {\n    // Your implementation here\n    public RateLimiter(int maxTokens, double refillRate) {\n    }\n    public boolean allowRequest() {\n        return false;\n    }\n}\n\nclass Main {\n    public static void main(String[] args) throws InterruptedException {\n        RateLimiter limiter = new RateLimiter(5, 2.0);\n        for (int i = 0; i < 10; i++) {\n            System.out.println(\"Request \" + (i + 1) + \": \" + (limiter.allowRequest() ? \"ALLOWED\" : \"REJECTED\"));\n            Thread.sleep(100);\n        }\n    }\n}",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks a settings Map against a schema definition. It must detect missing required keys, type mismatches, and out-of-range values, collecting all errors into a report.",
    requirements: [
      "Validate each key in the schema against the config Map",
      "Check for required keys, correct types, and numeric min/max ranges",
      "Collect all validation errors into a List (do not throw early)",
      "Return a Map with 'valid' (boolean) and 'errors' (List of strings)",
    ],
    starterCode:
      "import java.util.*;\n\nclass Main {\n    static Map<String, Object> validateConfig(Map<String, Object> config, List<Map<String, Object>> schema) {\n        // Your implementation here\n        Map<String, Object> result = new HashMap<>();\n        result.put(\"valid\", true);\n        result.put(\"errors\", new ArrayList<String>());\n        return result;\n    }\n\n    public static void main(String[] args) {\n        Map<String, Object> config = new HashMap<>();\n        config.put(\"host\", \"localhost\");\n        config.put(\"port\", 70000);\n        config.put(\"timeout\", -5);\n        // Add schema and test...\n        System.out.println(validateConfig(config, new ArrayList<>()));\n    }\n}",
  },
];

/* ------------------------------------------------------------------ */
/*  C                                                                  */
/* ------------------------------------------------------------------ */

const c: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a function that parses a raw CSV data stream (a null-terminated string) into an array of structs. The input may contain missing values (empty fields or '---'), malformed rows, and variable column counts. Your parser must handle each anomaly without segfaulting.",
    requirements: [
      "Tokenize the input by newline then comma, filling a struct array",
      "Replace missing numeric fields with 0 and string fields with 'unknown'",
      "Print a warning for each malformed row that is skipped",
      "Return the count of valid records parsed",
    ],
    starterCode:
      "#include <stdio.h>\n#include <string.h>\n\ntypedef struct { int id; char name[32]; int score; } Record;\n\nint parse_data_stream(char *raw, Record *out, int max_records) {\n    /* Your implementation here */\n    return 0;\n}\n\nint main(void) {\n    char raw[] = \"id,name,score\\n1,Alice,92\\n2,Bob,\\n3,,,\\n4,Charlie,85\";\n    Record records[64];\n    int count = parse_data_stream(raw, records, 64);\n    printf(\"Parsed %d records\\n\", count);\n    return 0;\n}",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a retry wrapper that calls an unreliable function pointer and retries on failure using exponential backoff. Use a callback pattern where the operation signals success or failure through its return value.",
    requirements: [
      "Accept a function pointer, max_retries, and base_delay_ms",
      "Double the delay each attempt and add small random jitter",
      "Print each retry attempt number and failure reason",
      "Return the operation result or -1 after all retries exhausted",
    ],
    starterCode:
      "#include <stdio.h>\n#include <stdlib.h>\n#include <time.h>\n\ntypedef int (*Operation)(void);\n\nint with_retry(Operation op, int max_retries, int base_delay_ms) {\n    /* Your implementation here */\n    return -1;\n}\n\nint attempt = 0;\nint unreliable_api(void) {\n    attempt++;\n    if (attempt < 3) { printf(\"  API failure\\n\"); return -1; }\n    printf(\"  API success\\n\"); return 42;\n}\n\nint main(void) {\n    srand((unsigned)time(NULL));\n    int result = with_retry(unreliable_api, 5, 100);\n    printf(\"Final result: %d\\n\", result);\n    return 0;\n}",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a rate limiter using the Token Bucket algorithm in C. Track available tokens as a double, refill based on elapsed wall-clock time, and provide a single allow_request function that returns 1 (allowed) or 0 (rejected).",
    requirements: [
      "Define a RateLimiter struct with max_tokens, refill_rate, tokens, and last_time",
      "Implement allow_request() that refills tokens based on elapsed time",
      "Consume one token per allowed request, reject when tokens < 1.0",
      "Return 1 when allowed, 0 when rejected",
    ],
    starterCode:
      "#include <stdio.h>\n#include <time.h>\n\ntypedef struct {\n    int max_tokens;\n    double refill_rate;\n    double tokens;\n    clock_t last_time;\n} RateLimiter;\n\nvoid limiter_init(RateLimiter *rl, int max_tokens, double refill_rate) {\n    /* Your implementation here */\n}\n\nint allow_request(RateLimiter *rl) {\n    /* Your implementation here */\n    return 0;\n}\n\nint main(void) {\n    RateLimiter rl;\n    limiter_init(&rl, 5, 2.0);\n    for (int i = 0; i < 10; i++) {\n        printf(\"Request %d: %s\\n\", i + 1, allow_request(&rl) ? \"ALLOWED\" : \"REJECTED\");\n    }\n    return 0;\n}",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks an array of key-value pairs against a schema. It must detect missing required keys, type mismatches, and out-of-range numeric values, collecting all errors into a single report.",
    requirements: [
      "Define ConfigEntry and ValidationError structs to hold data and errors",
      "Check for required keys, correct value types, and numeric ranges",
      "Collect all validation errors (do not stop at the first failure)",
      "Print the validation report showing all errors found",
    ],
    starterCode:
      "#include <stdio.h>\n#include <string.h>\n\ntypedef struct { char key[32]; char value[64]; } ConfigEntry;\ntypedef struct { char message[128]; } ValidationError;\n\nint validate_config(ConfigEntry *config, int config_len, ValidationError *errors, int max_errors) {\n    /* Your implementation here */\n    return 0;\n}\n\nint main(void) {\n    ConfigEntry config[] = {\n        {\"host\", \"localhost\"}, {\"port\", \"70000\"}, {\"timeout\", \"-5\"}\n    };\n    ValidationError errors[16];\n    int count = validate_config(config, 3, errors, 16);\n    printf(\"Found %d validation errors\\n\", count);\n    for (int i = 0; i < count; i++) printf(\"  - %s\\n\", errors[i].message);\n    return 0;\n}",
  },
];

/* ------------------------------------------------------------------ */
/*  C++                                                                */
/* ------------------------------------------------------------------ */

const cpp: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a function that parses a raw CSV data stream into a vector of Record structs. The input may contain missing values (empty fields or '---'), malformed rows, and unexpected delimiters. Use RAII and exception-safe techniques throughout.",
    requirements: [
      "Split the input by newline and parse each row as comma-separated values",
      "Replace missing numeric values with 0 and string fields with 'unknown'",
      "Log a warning to std::cerr for each malformed row that is skipped",
      "Return a std::vector of valid, cleaned Record structs",
    ],
    starterCode:
      "#include <iostream>\n#include <string>\n#include <vector>\n#include <sstream>\n\nstruct Record { int id; std::string name; int score; };\n\nstd::vector<Record> parseDataStream(const std::string& raw) {\n    // Your implementation here\n    return {};\n}\n\nint main() {\n    std::string rawInput = \"id,name,score\\n1,Alice,92\\n2,Bob,\\n3,,,\\n4,Charlie,85\";\n    auto result = parseDataStream(rawInput);\n    std::cout << \"Parsed \" << result.size() << \" records\" << std::endl;\n    return 0;\n}",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a generic retry utility template that wraps an unreliable callable and retries it on exception using exponential backoff with jitter. Use std::function and templates for type safety.",
    requirements: [
      "Accept a std::function, maxRetries count, and baseDelay in milliseconds",
      "Wait baseDelay * 2^attempt + random jitter between each retry using std::this_thread::sleep_for",
      "Log each retry attempt number and the exception message to std::cerr",
      "Re-throw the last exception after all retries are exhausted",
    ],
    starterCode:
      "#include <iostream>\n#include <functional>\n#include <chrono>\n#include <thread>\n#include <random>\n#include <stdexcept>\n\ntemplate<typename T>\nT withRetry(std::function<T()> fn, int maxRetries, int baseDelayMs) {\n    // Your implementation here\n    return fn();\n}\n\nint main() {\n    int attempt = 0;\n    try {\n        auto result = withRetry<std::string>([&]() -> std::string {\n            attempt++;\n            if (attempt < 3) throw std::runtime_error(\"Service unavailable\");\n            return \"OK\";\n        }, 5, 100);\n        std::cout << \"Success: \" << result << std::endl;\n    } catch (const std::exception& e) {\n        std::cerr << \"Failed: \" << e.what() << std::endl;\n    }\n    return 0;\n}",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a thread-safe rate limiter class using the Token Bucket algorithm. Use std::chrono for high-resolution time tracking and std::mutex for concurrency safety.",
    requirements: [
      "Accept maxTokens capacity and refillRate (tokens per second)",
      "Each call to allowRequest() consumes one token if available",
      "Tokens refill continuously based on elapsed time since last check",
      "Use std::mutex to make the class thread-safe",
    ],
    starterCode:
      "#include <iostream>\n#include <chrono>\n#include <mutex>\n#include <thread>\n\nclass RateLimiter {\npublic:\n    RateLimiter(int maxTokens, double refillRate) {\n        // Your implementation here\n    }\n    bool allowRequest() {\n        // Your implementation here\n        return false;\n    }\nprivate:\n    int maxTokens_;\n    double refillRate_;\n    double tokens_;\n    std::chrono::steady_clock::time_point lastTime_;\n    std::mutex mutex_;\n};\n\nint main() {\n    RateLimiter limiter(5, 2.0);\n    for (int i = 0; i < 10; i++) {\n        std::cout << \"Request \" << (i + 1) << \": \"\n                  << (limiter.allowRequest() ? \"ALLOWED\" : \"REJECTED\") << std::endl;\n        std::this_thread::sleep_for(std::chrono::milliseconds(100));\n    }\n    return 0;\n}",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks a JSON string against a schema definition. It must detect missing required fields, type mismatches, and out-of-range numeric values, collecting all errors into a vector.",
    requirements: [
      "Parse the JSON config string using std::stringstream (simple key:value format)",
      "Check for required keys, correct value types, and numeric min/max ranges",
      "Collect all validation errors into a std::vector<std::string>",
      "Return a result struct with a valid flag and the error list",
    ],
    starterCode:
      "#include <iostream>\n#include <string>\n#include <vector>\n#include <sstream>\n#include <map>\n\nstruct ValidationResult {\n    bool valid;\n    std::vector<std::string> errors;\n};\n\nValidationResult validateConfig(const std::string& configJson) {\n    // Your implementation here\n    return { true, {} };\n}\n\nint main() {\n    std::string config = \"host=localhost,port=70000,timeout=-5\";\n    auto result = validateConfig(config);\n    std::cout << (result.valid ? \"VALID\" : \"INVALID\") << std::endl;\n    for (const auto& err : result.errors) std::cerr << \"  - \" << err << std::endl;\n    return 0;\n}",
  },
];

/* ------------------------------------------------------------------ */
/*  C#                                                                 */
/* ------------------------------------------------------------------ */

const csharp: ChallengeInfo[] = [
  {
    title: "Resilient Data Stream Parser",
    description:
      "Write a method that parses a raw CSV data stream into a list of Record objects. The input may contain missing values (empty strings or '---'), malformed rows, and unexpected delimiters. Your parser must handle each anomaly without throwing unhandled exceptions.",
    requirements: [
      "Split the input by newline and parse each row as comma-separated values",
      "Replace missing numeric values with 0 and string fields with 'unknown'",
      "Log a warning to Console for each malformed row that is skipped",
      "Return a List of valid, cleaned Record objects",
    ],
    starterCode:
      "using System;\nusing System.Collections.Generic;\n\nnamespace ChaosLab\n{\n    class Record { public int Id; public string Name; public int Score; }\n\n    class Program\n    {\n        static List<Record> ParseDataStream(string raw)\n        {\n            // Your implementation here\n            return new List<Record>();\n        }\n\n        static void Main(string[] args)\n        {\n            string rawInput = \"id,name,score\\n1,Alice,92\\n2,Bob,\\n3,,,\\n4,Charlie,85\";\n            var result = ParseDataStream(rawInput);\n            Console.WriteLine($\"Parsed {result.Count} records\");\n        }\n    }\n}",
  },
  {
    title: "Retry Mechanism with Exponential Backoff",
    description:
      "Implement a generic retry utility that wraps an unreliable Func delegate and retries it on exception using exponential backoff with jitter. Use Func<T> for type-safe return values.",
    requirements: [
      "Accept a Func<T>, maxRetries count, and baseDelay in milliseconds",
      "Wait baseDelay * 2^attempt + random jitter between each retry using Thread.Sleep",
      "Log each retry attempt number and the exception message",
      "Throw the last exception after all retries are exhausted",
    ],
    starterCode:
      "using System;\nusing System.Threading;\n\nnamespace ChaosLab\n{\n    class Program\n    {\n        static T WithRetry<T>(Func<T> fn, int maxRetries, int baseDelayMs)\n        {\n            // Your implementation here\n            return fn();\n        }\n\n        static int attempt = 0;\n\n        static void Main(string[] args)\n        {\n            try\n            {\n                var result = WithRetry(() =>\n                {\n                    attempt++;\n                    if (attempt < 3) throw new Exception(\"Service unavailable\");\n                    return \"OK\";\n                }, 5, 100);\n                Console.WriteLine($\"Success: {result}\");\n            }\n            catch (Exception e)\n            {\n                Console.Error.WriteLine($\"Failed: {e.Message}\");\n            }\n        }\n    }\n}",
  },
  {
    title: "Token Bucket Rate Limiter",
    description:
      "Implement a thread-safe rate limiter class using the Token Bucket algorithm. Use lock-based synchronization for thread safety and DateTime for time tracking.",
    requirements: [
      "Accept maxTokens capacity and refillRate (tokens per second)",
      "Each call to AllowRequest() consumes one token if available",
      "Tokens refill continuously based on elapsed time since last check",
      "Use lock to ensure thread-safe token management",
    ],
    starterCode:
      "using System;\nusing System.Threading;\n\nnamespace ChaosLab\n{\n    class RateLimiter\n    {\n        public RateLimiter(int maxTokens, double refillRate)\n        {\n            // Your implementation here\n        }\n\n        public bool AllowRequest()\n        {\n            // Your implementation here\n            return false;\n        }\n    }\n\n    class Program\n    {\n        static void Main(string[] args)\n        {\n            var limiter = new RateLimiter(5, 2.0);\n            for (int i = 0; i < 10; i++)\n            {\n                string status = limiter.AllowRequest() ? \"ALLOWED\" : \"REJECTED\";\n                Console.WriteLine($\"Request {i + 1}: {status}\");\n                Thread.Sleep(100);\n            }\n        }\n    }\n}",
  },
  {
    title: "Configuration Validator with Error Recovery",
    description:
      "Build a configuration validator that checks a Dictionary<string, object> against a schema definition. It must detect missing required keys, type mismatches, and out-of-range values, collecting all errors into a report.",
    requirements: [
      "Validate each key in the schema against the config Dictionary",
      "Check for required keys, correct types, and numeric min/max ranges",
      "Collect all validation errors into a List<string> (do not throw early)",
      "Return a result object with Valid (bool) and Errors (List<string>)",
    ],
    starterCode:
      "using System;\nusing System.Collections.Generic;\n\nnamespace ChaosLab\n{\n    class ValidationResult { public bool Valid; public List<string> Errors = new(); }\n\n    class Program\n    {\n        static ValidationResult ValidateConfig(Dictionary<string, object> config, List<Dictionary<string, object>> schema)\n        {\n            // Your implementation here\n            return new ValidationResult { Valid = true };\n        }\n\n        static void Main(string[] args)\n        {\n            var config = new Dictionary<string, object>\n            {\n                { \"host\", \"localhost\" }, { \"port\", 70000 }, { \"timeout\", -5 }\n            };\n            var result = ValidateConfig(config, new List<Dictionary<string, object>>());\n            Console.WriteLine(result.Valid ? \"VALID\" : $\"INVALID ({result.Errors.Count} errors)\");\n        }\n    }\n}",
  },
];

/* ------------------------------------------------------------------ */
/*  Exported pool                                                      */
/* ------------------------------------------------------------------ */

export const SCENARIO_POOL: Record<SnippetLang, ChallengeInfo[]> = {
  javascript,
  python,
  java,
  c,
  cpp,
  csharp,
};
