// import { time } from "console";
// import { getRuntime } from "openai/_shims/node-runtime.mjs";

const vscode = require("vscode");
const OpenAI = require("openai");
let panel;
const openai = new OpenAI({
	apiKey: "" // api key here,
});

async function generateWithGPT4(prompt, model) {
	try {
		//console.log(`Categorized as: ${category}`);
		const completion = await openai.chat.completions.create({
			messages: [
				{ role: "system", content: "You are a coding assistant that receives code in the following format: ***FILE PATH***\n${file.fsPath}\n***FILE CONTENTS***\n${content}\n***END FILE*** and a user request to do something to said files/code after. You make the necessary edits and return the code and its edits back and nothing more. If there is no given code or you think you need more files and more code, you can generate the file with code you think you need using a file path with the same logic as a given file path. The created filepath should always be in the form of the given file paths. If the user requests you to generate a boilerplate or project from scratch, generate all necessary files and code structures in the given format. If you add anything outside the structure, the program will not work as your output is fed directly into an IDE. NEVER skip, omit or elide content using '...' or by adding comments like '... rest of code...' \nPlease always generate full content of each file, if you don't the system wont work." },
				{ role: "user", content: prompt },
			],
			model: model, //can easily swap to GPT-4
		});

		console.log("\n~~~~\n\nSuccessfully Called GPT");
		return completion.choices[0].message.content;
	} catch (error) {
		console.error("Error calling GPT:", error);
		throw error;
	}
}

async function getCategorizationFromGPT(prompt, model) {
	try {
		const categorizationResponse = await openai.chat.completions.create({
			model: model,
			messages: [
				{
					role: "user",
					content: `You are a function calling categorizer that categorizes user prompts into 1 of 12 categories and returns only the word of the category. The categories with their one word and description are:
                    1. EDIT - The user is asking the system to edit code, or giving a general command like "make this red" or "add a function" or "change this to that". This is the most likely result.
                    2. PROJECT - The user is asking the system to generate a whole project from scratch or do a large task, like build the game of snake, or generate an entire javaspringboot app for retrieving stock market data. Only use this when they say generate or create, otherwise use EDIT.
                    3. CODEQUESTION - The user has a question about the given code, like "what does this code do", or "explain this functions purpose" that isn't necessarilly asking for edits to the codebase
                    4. OPTIMIZE - The user wants the section of the code edited and optimized for performance, speed and efficiency. This prompt will often include synonyms to optimize.
                    5. REFACTOR - The user wants the code refactored for readability and maintainability. The reason for this could be for better looking code or so that the code is better structured.
                    6. DEBUG - The user is getting bugs and wants you to debug and suggest solutions. This is often envoked by things like "debug this" or "fix this error" or "this function doesn't work"
                    7. TEST - The user wants you to generate test cases to test the current code and think of fringe scenarios that may break the code or cause bugs
                    8. DOCUMENT - The user wants you to create documentation for the code, or comment-mark-up with explanations over the existing code.
                    9. RESEARCH - The user wants you to research a topic, like benefits of certain architectures or best ways to develop a project. This can also be used if the user asks for a lengthy blog post about a topic or how to do something complex that requires several complicated steps. Research topics can be anything, but a few examples are current events, historical events, scientific research papers, disease, financial theory, or engineering. Another research use case is invoked by language like "What is the *BEST* stock/product/solution/purchase etc. to invest/buy/do/learn etc.
                    10. REGQUESTION - User has a question to answer that is not relevant to code or the given code like 'what is an eigenvector' or 'what is java springboot used for?'. Before marking something as REGQUESTION, you should first check if it is actually a coding question or a request to edit something.
                    11. README - Only used when the user specifically asks to generate a README file.
                    12. MISFIRE - the user typed in and sent a meaningless or jibberish request, either on accident or without much care. Only use MISFIRE as a last resort or for something clearly meaningless or malicious.
                    Here is the prompt for you to categorize:
                    \n${prompt}
                    \n\nNo matter what, only return one singular word, the word assigned to the category. If you return anything else at all, the program will break.
                    `,
				},
			],
		});

		// Inner function to extract the category from the response
		function extractCategory(responseContent) {
			const categories = ["EDIT", "PROJECT", "CODEQUESTION", "OPTIMIZE", "REFACTOR", "DEBUG", "TEST", "DOCUMENT", "RESEARCH", "REGQUESTION", "README", "MISFIRE"]; // RESEARCH -> GPT RESEARCHER
			const matchedCategories = responseContent.match(new RegExp(`\\b(${categories.join("|")})\\b`, "g"));

			if (matchedCategories && matchedCategories.length === 1) {
				return matchedCategories[0];
			} else {
				return "MISFIRE";
			}
		}
        extractedCategory = extractCategory(categorizationResponse.choices[0].message.content)
        vscode.window.showInformationMessage("The semantic router routes to: " + extractedCategory);

		// Use the inner function to extract the category
		return extractedCategory;

	} catch (error) {
		console.error("Error in categorization:", error);
		throw error;
	}
}

// Will be replaced with Semantic Search and other methods
async function getAllFilesContent() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage("No workspace folder is opened.");
		return "";
	}

	const workspaceFolder = workspaceFolders[0];
	const pattern = "**/*"; // Adjust this pattern to include/exclude certain files
	const files = await vscode.workspace.findFiles(pattern);
	let allFilesContent = "";

	for (const file of files) {
		try {
			const fileContent = await vscode.workspace.fs.readFile(file);
			const content = Buffer.from(fileContent).toString("utf-8");
			allFilesContent += `***FILE PATH***\n${file.fsPath}\n***FILE CONTENTS***\n${content}\n***END FILE***\n`;
		} catch (error) {
			console.error(`Error reading file ${file.fsPath}: ${error}`);
		}
	}
	console.log(allFilesContent);
	return allFilesContent;
}

// The CORE/literal router of the Semantic Router
async function processMessage(message) {
    try {
        const category = await getCategorizationFromGPT(message.prompt, message.model);
        console.log(`Categorized as: ${category}`);

        switch (category) {
            case 'EDIT':
                await handleEditCategory(message.prompt, message.model);
                break;
            case 'PROJECT': //RIGHT NOW THIS ALSO GOES TO EDIT - BE SURE TO CHANGE AND FIX LATER!
                handleEditCategory(message.prompt, message.model);
                break;
            case 'CODEQUESTION': //RIGHT NOW THIS ALSO GOES TO REQQUESTION - BE SURE TO CHANGE AND FIX LATER!
                handleRegQuestionCategory(message.prompt, message.model);
                break;
            case 'OPTIMIZE':
                handleOptimizeCategory(message.prompt, message.model);
                break;
			case 'REFACTOR':
				handleRefactorCategory(message.prompt, message.model);
				break;				
			case 'DEBUG':
				handleDebugCategory(message.prompt, message.model);
				break;
			case 'TEST':
				handleTestCategory(message.prompt, message.model);
				break;
			case 'DOCUMENT':
				handleDocumentCategory(message.prompt, message.model);
				break;
			case 'RESEARCH':
				handleResearchCategory(message.prompt, message.model);
				break;
			case 'REGQUESTION':
				handleRegQuestionCategory(message.prompt, message.model);
				break;
			case 'README':
				handleReadmeCategory(message.prompt, message.model);
				break;
			case 'MISFIRE':
				handleMisfireCategory(message.prompt, message.model);
				break;
            default:
                handleMisfireCategory();
                break;
        }
    } catch (error) {
        console.error("Error processing message:", error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}

async function handleEditCategory(prompt, model) {
    try {
        const allFilesContent = await getAllFilesContent();
        const formattedPrompt = `${allFilesContent}\n*END ALL CONTENT*\nUser request:\n${prompt}`;

        const gpt4Response = await generateWithGPT4(formattedPrompt, model);
        console.log("\n~~~~\nGPT-4 Response:\n", gpt4Response);

        // Process and write files
        const fileSections = gpt4Response.split("***END FILE***");
        for (const section of fileSections) {
            if (section.trim() === "") continue;

            // Improved parsing logic
            const pathStart = section.indexOf("***FILE PATH***") + "***FILE PATH***".length;
            const pathEnd = section.indexOf("***FILE CONTENTS***");
            if (pathStart === -1 || pathEnd === -1) {
                console.error("Invalid section format:", section);
                continue;
            }

            const filePath = section.substring(pathStart, pathEnd).trim();
            const fileContents = section.substring(section.indexOf("***FILE CONTENTS***") + "***FILE CONTENTS***".length).trim();

            if (!filePath) {
                console.error("No file path found in section:", section);
                continue;
            }

            // Normalize file path for Windows environments
            const normalizedFilePath = filePath.replace(/\\/g, "/");
            console.log("Normalized file path:", normalizedFilePath);

            const fileUri = vscode.Uri.file(normalizedFilePath);

            let originalContent;
            try {
                originalContent = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString();
            } catch (error) {
                console.error(`Error reading original file content: ${error}`);
                originalContent = ""; // Use empty string if file does not exist or can't be read
            }

            const buffer = Buffer.from(fileContents, "utf-8");

            // Check if file exists, create it if it does not
            try {
                const fileStat = await vscode.workspace.fs.stat(fileUri);
                console.log(`File exists: ${fileStat.isFile}`);
            } catch (statError) {
                if (statError.code === "FileNotFound") {
                    console.log(`File does not exist, creating new file: ${normalizedFilePath}`);
                    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(""));
                } else {
                    throw statError;
                }
            }

            // Write or overwrite the file with new contents
            try {
                await vscode.workspace.fs.writeFile(fileUri, buffer);
                vscode.window.showInformationMessage(`File updated: ${normalizedFilePath}`);
            } catch (writeError) {
                console.error(`Error writing to file ${normalizedFilePath}:`, writeError);
                vscode.window.showErrorMessage(`Error writing to file ${normalizedFilePath}: ${writeError.message}`);
            }
            setTimeout(() => {
                highlightChangedLines(originalContent, fileContents, fileUri);
            }, 1000); // 1 seconds delay

        }

        vscode.window.showInformationMessage("All files processed.");



        panel.webview.postMessage({ command: "operationComplete" });
    } catch (error) {
        console.error("Error processing GPT-4 response:", error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}

// Function to highlight changed lines
async function highlightChangedLines(originalContent, updatedContent, fileUri) {
    const originalLines = originalContent.split('\n');
    const updatedLines = updatedContent.split('\n');

    let changedLines = [];
    for (let i = 0; i < Math.max(originalLines.length, updatedLines.length); i++) {
        // Check if the lines are different and within the length of both files
        if (i < originalLines.length && i < updatedLines.length && originalLines[i] !== updatedLines[i]) {
            // vscode.Range is zero-based, so no adjustment is needed for line numbers
            changedLines.push(new vscode.Range(i, 0, i, 0));
        } else if (i >= originalLines.length && i < updatedLines.length) {
            // If the updated file is longer, mark the additional lines as changed
            changedLines.push(new vscode.Range(i, 0, i, 0));
        } else if (i >= updatedLines.length && i < originalLines.length) {
            // If the original file is longer, mark the removed lines as changed
            changedLines.push(new vscode.Range(i, 0, i, 0));
        }
    }

    const editor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.path === fileUri.path);
    if (editor) {
        editor.setDecorations(changedLineDecorationType, changedLines);
    }
}

// Currently unused because Project == Edit, must change above code so that handleProjectCategory can be called when larger project generation is available.
async function handleProjectCategory() {
    // Dummy implementation for the 'PROJECT' category
    printToChatBubble("CATEGORY: PROJECT - I am working");
}

async function handleCodeQuestionCategory(prompt, model) {
    printToChatBubble("CATEGORY: CODEQUESTION - I am working");
}

async function handleOptimizeCategory(prompt, model) {
    printToChatBubble("CATEGORY: OPTIMIZE - I am working");
}

async function handleRefactorCategory(prompt, model) {
    printToChatBubble("CATEGORY: REFACTOR - I am working");
}

async function handleDebugCategory(prompt, model) {
    printToChatBubble("CATEGORY: DEBUG - I am working");
}

async function handleTestCategory(prompt, model) {
    printToChatBubble("CATEGORY: TEST - I am working");
}

async function handleDocumentCategory(prompt, model) {
    printToChatBubble("CATEGORY: DOCUMENT - I am working");
}

async function handleResearchCategory(prompt, model) {
    printToChatBubble("CATEGORY: RESEARCH - I am working");
}

async function handleRegQuestionCategory(prompt, model) {
    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful and knowledgeable assistant." },
                { role: "user", content: prompt },
            ],
            model: model, //can easily swap to GPT-4
        }); 
        console.log("\n~~~~\n\nSuccessfully Called GPT");

        response = completion.choices[0].message.content;
        printToChatBubble("CATEGORY: REGQUESTION - " + response);
    } catch (error) {
        console.error("Error calling GPT:", error);
        throw error;
    }
}

async function handleReadmeCategory(prompt, model) {
    printToChatBubble("CATEGORY: README - I am working");
}

async function handleMisfireCategory(prompt, model) {
    printToChatBubble("CATEGORY: MISFIRE - I am working");
}

async function printToChatBubble(message) {
    if (panel && panel.webview) {
        panel.webview.postMessage({
            command: 'printToChatBubble',
            text: message
        });
    }
}

// async function findFunctionReferencesInProject(functionName) {
//     const workspaceFolders = vscode.workspace.workspaceFolders;
//     if (!workspaceFolders || workspaceFolders.length === 0) {
//         vscode.window.showErrorMessage("No workspace folder is opened.");
//         return;
//     }

//     const workspaceFolder = workspaceFolders[0].uri.fsPath;
//     const excludePattern = "**/{node_modules,.next}/**"; // 👈 Add more excluded dirs as needed
//     const files = await vscode.workspace.findFiles('**/*.js', excludePattern); // 👈 Now uses the exclusion pattern

//     for (const file of files) {
//         try {
//             const content = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf8');
//             // For simplicity, we're directly using content.includes. For real use, you would parse the content.
//             if (content.includes(functionName)) {
//                 console.log(`Reference found in ${file.fsPath}`);
//                 // Send back file and location information to the webview or handle it as needed
//             }
//         } catch (error) {
//             console.error(`Error processing file ${file.fsPath}: ${error}`);
//         }
//     }

//     const Parser = require('tree-sitter');
//     const JavaScript = require('tree-sitter-javascript');
    
//     const parser = new Parser();
//     parser.setLanguage(JavaScript);

//     const sourceCode = 'let x = 1; console.log(x);';
//     const tree = parser.parse(sourceCode);

//     console.log(tree.rootNode.toString());

//     // (program
//     //   (lexical_declaration
//     //     (variable_declarator (identifier) (number)))
//     //   (expression_statement
//     //     (call_expression
//     //       (member_expression (identifier) (property_identifier))
//     //       (arguments (identifier)))))

//     const callExpression = tree.rootNode.child(1).firstChild;
//     console.log(callExpression);

//     // { type: 'call_expression',
//     //   startPosition: {row: 0, column: 16},
//     //   endPosition: {row: 0, column: 30},
//     //   startIndex: 0,
//     //   endIndex: 30 }

//     vscode.window.showInformationMessage(`Search for '${functionName}' completed.`);
// }

// async function treeSitterParsing(){
//     const Parser = require('tree-sitter');
//     const JavaScript = require('tree-sitter-javascript');
    
//     const parser = new Parser();
//     parser.setLanguage(JavaScript);

//     const sourceCode = 'let x = 1; console.log(x);';
//     const tree = parser.parse(sourceCode);

//     console.log(tree.rootNode.toString());

//     // (program
//     //   (lexical_declaration
//     //     (variable_declarator (identifier) (number)))
//     //   (expression_statement
//     //     (call_expression
//     //       (member_expression (identifier) (property_identifier))
//     //       (arguments (identifier)))))

//     const callExpression = tree.rootNode.child(1).firstChild;
//     console.log(callExpression);

//     // { type: 'call_expression',
//     //   startPosition: {row: 0, column: 16},
//     //   endPosition: {row: 0, column: 30},
//     //   startIndex: 0,
//     //   endIndex: 30 }
// }

function activate(context) {
	console.log('Your extension "Zoo-autocoder" is now active!');

	let disposable = vscode.commands.registerCommand("Zoo-autocoder.generateCode", async function () {
		vscode.window.showInformationMessage("Hello World from Zoo AutoCoder!");

    
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage("No workspace folder is opened.");
			return;
		}

		const workspaceFolder = workspaceFolders[0];
		panel = vscode.window.createWebviewPanel("zooAutoCoder", "Zoo AutoCoder Panel", vscode.ViewColumn.Two, {
			enableScripts: true,
			webviewOptions: { allowClipboardAccess: true },
		});

		panel.webview.html = getWebviewContent();

        async function updateTokenCount() {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const fileContent = activeEditor.document.getText();
                const tokenCount = Math.ceil(fileContent.length / 4);
    
                // Send the token count to the webview
                panel.webview.postMessage({
                    command: 'updateTokenCount',
                    tokenCount: tokenCount
                });
            }
        }
    
        // Event listeners for updating token count
        vscode.window.onDidChangeActiveTextEditor(updateTokenCount);
        vscode.workspace.onDidChangeTextDocument(event => {
            if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                updateTokenCount();
            }
        });


		panel.webview.onDidReceiveMessage(async (message) => {
			if (message.command === "generateCode") {
                await processMessage(message)
            } else if (message.command === "findFunctionReferences") {
                await findFunctionReferencesInProject(message.functionName);
            }
		});

		panel.onDidDispose(() => {
			// Cleanup code, if needed.
		});
	});

	context.subscriptions.push(disposable);

     // Automatically execute the command after registration
     vscode.commands.executeCommand("Zoo-autocoder.generateCode");
}

const changedLineDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 102, 102, 0.3)', // You can customize the color and style
    isWholeLine: true
});

function getWebviewContent() {
	return `
    <html>
    <head>
        <style>
            #logo {
                position: fixed;
                top: 10px;
                right: 10px;
                height: 50px;
            }
            #loadingIndicator {
                display: none;
                margin-top: 10px;
            }
            #userLog {
                margin-top: 20px;
            }
            .chat-bubble {
                background-color: #0078D7;
                color: white;
                border-radius: 10px;
                padding: 10px;
                margin: 5px 0;
                max-width: 80%;
                word-wrap: break-word;
            }
            .chat-bubble-response {
                margin: 10px;
                padding: 10px;
                border-radius: 10px;
                background-color: limegreen;
                color: white;
                display: inline-block;
            }
            .user-input {
                align-self: flex-start;
            }
            /* Tab container and tab styles */
            .tab-container {
                overflow: hidden;
                border: 1px solid #ccc;
                background-color: #f1f1f1;
                height: 100%
            }
            .tab-container button {
                background-color: inherit;
                float: left;
                border: none;
                outline: none;
                cursor: pointer;
                padding: 14px 16px;
                transition: 0.3s;
            }
            .tab-container button:hover {
                background-color: #ddd;
            }
            .tab-container button.active {
                background-color: #ccc;
            }

            /* Tab content (hidden by default) */
            .tab-content {
                display: none;
                padding: 6px 12px;
                border: 1px solid #ccc;
                border-top: none;
            }
            #modelSelector {
                position: fixed;
                bottom: 10px;
                right: 10px;
                border: 1px solid #ccc;
            }
            #tokenCount {
                position: fixed;
                bottom: 30px;
                right: 10px;
            }
        </style>
    </head>
    <body>
    <div class="tab-container">
        <button class="tab-button" onclick="openTab(event, 'AutoCoder')">Zooter</button>
        <button class="tab-button" onclick="openTab(event, 'CodingAssistant')">Assistant/Settings</button>
    </div>
    <div id="AutoCoder" class="tab-content">
        <h1>Zoot</h1>
        <input type="text" id="gpt4Prompt" placeholder="Enter prompt...">
        <button onclick="processMessage()">Generate and Save</button>
        <!--<button onclick="findFunctionReferences()">Find Function (getActivities-hardcoded) References</button>-->
        <div id="loadingIndicator">Loading...</div>
        <div id="userLog"></div>
        <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('gpt4Prompt').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                processMessage();
            }
        });

        function processMessage() {
            const promptInput = document.getElementById('gpt4Prompt');
            const modelSelector = document.getElementById('modelSelector');
            const prompt = promptInput.value;
            const model = modelSelector.value; // Get the selected model

            vscode.postMessage({ command: 'generateCode', prompt, model });

            document.getElementById('loadingIndicator').style.display = 'block';

            // Append the prompt as a chat bubble to the user log
            const logEntry = document.createElement('div');
            logEntry.classList.add('chat-bubble', 'user-input');
            logEntry.textContent = prompt;
            document.getElementById('userLog').appendChild(logEntry);
            promptInput.value = ''; // Clear the input field after sending
        }

        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'printToChatBubble':
                    addChatBubble(message.text);
                    break;
                // Handle other messages...
            }
        });

        function addChatBubble(text) {
            const logEntry = document.createElement('div');
            logEntry.classList.add('chat-bubble-response');
            logEntry.textContent = text;
            document.getElementById('userLog').appendChild(logEntry);
        }

        window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'operationComplete':
                document.getElementById('loadingIndicator').style.display = 'none';
                break;
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateTokenCount':
                    const tokenCountElement = document.getElementById('tokenCount');
                    if (tokenCountElement) {
                        tokenCountElement.textContent = 'Tokens in Active File: ' + message.tokenCount;
                    }
                    break;
                }
            });

        function openTab(evt, tabName) {
            var i, tabcontent, tabbuttons;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tabbuttons = document.getElementsByClassName("tab-button");
            for (i = 0; i < tabbuttons.length; i++) {
                tabbuttons[i].className = tabbuttons[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }

        // Open the first tab by default
        document.getElementsByClassName("tab-button")[0].click();
    </script>
        </div>
        <div id="tokenCount">Token's in Active Window': 0</div>
        <select id="modelSelector">
        <option value="gpt-3.5-turbo">GPT-3.5-turbo</option>
        <option value="gpt-4">GPT-4</option>
        </select>
        <div id="CodingAssistant" class="tab-content">
            <h1>Coding Assistant</h1>
            <!-- Content for Coding Assistant tab -->
        </div>

        <script>

            function findFunctionReferences() {
                vscode.postMessage({ command: 'findFunctionReferences', functionName: 'getActivities' });
            }

            function openTab(evt, tabName) {
                var i, tabcontent, tabbuttons;
                tabcontent = document.getElementsByClassName("tab-content");
                for (i = 0; i < tabcontent.length; i++) {
                    tabcontent[i].style.display = "none";
                }
                tabbuttons = document.getElementsByClassName("tab-button");
                for (i = 0; i < tabbuttons.length; i++) {
                    tabbuttons[i].className = tabbuttons[i].className.replace(" active", "");
                }
                document.getElementById(tabName).style.display = "block";
                evt.currentTarget.className += " active";
            }

            // Open the first tab by default
            document.getElementsByClassName("tab-button")[0].click();
        </script>
    </body>
    </html>
  `;
}


function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
