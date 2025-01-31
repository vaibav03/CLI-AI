import { exec } from "child_process";
import fs from "fs";
import path from "path";
import process from "process";

const StepType = {
  CreateFolder: "CreateFolder",
  CreateFile: "CreateFile",
  RunScript: "RunScript",
};

export function parseXml(response) {
  // Extract the XML content between <boltArtifact> tags
  const xmlMatch = response.match(
    /<boltArtifact[^>]*>([\s\S]*?)<\/boltArtifact>/,
  );

  if (!xmlMatch) {
    return [];
  }

  const xmlContent = xmlMatch[1];
  const steps = [];
  let stepId = 1;

  // Extract artifact title
  const titleMatch = response.match(/title="([^"]*)"/);
  const artifactTitle = titleMatch ? titleMatch[1] : "Project Files";

  // Add initial artifact step
  steps.push({
    id: stepId++,
    title: artifactTitle,
    description: "",
    type: StepType.CreateFolder,
    status: "pending",
  });

  // Regular expression to find boltAction elements
  const actionRegex =
    /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;

  let match;
  while ((match = actionRegex.exec(xmlContent)) !== null) {
    const [, type, filePath, content] = match;

    if (type === "file") {
      // File creation step
      steps.push({
        id: stepId++,
        title: `Create ${filePath || "file"}`,
        description: "",
        type: StepType.CreateFile,
        status: "pending",
        code: content.trim(),
        path: filePath,
      });
    } else if (type === "shell") {
      steps.push({
        id: stepId++,
        title: "Run command",
        description: "",
        type: StepType.RunScript,
        status: "pending",
        code: content.trim(),
      });
    }
  }

  return steps;
}


export const createFiles = (response) => {
  const steps = parseXml(response);
  const __dirname = (new URL(process.cwd()).pathname)
  const baseDir = path.join(__dirname, "test");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
    return console.log(`Directory created: ${baseDir}`);
  }
  steps.forEach((step) => {
    if (step.path) {
      const fullPath = path.join(baseDir, step.path);
      const dir = path.dirname(fullPath);
      const filePath = fullPath;

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Directory created: ${dir}`);
      }

      if (step.code) {
        fs.writeFileSync(filePath, step.code);
        console.log(`File created: ${filePath}`);
      } else {
        fs.writeFileSync(filePath, "");
        console.log(`Empty file created: ${filePath}`);
      }
    } else if (step.type === "RunScript") {
      try {
        console.log(`Running script: ${step.code}`);
        const command = step.code.split("&&");
        command.forEach((cmd) => {
          exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`stderr: ${stderr}`);
              return;
            }
            console.log(`stdout: ${stdout}`);
          });
        });
        console.log("Script executed");
      } catch (error) {
        console.error(`Failed to execute script: ${error.message}`);
      }
    }
  });
};


export const clearFiles = () => {
  const dir = process.cwd();
  console.log(`Attempting to clear: ${dir}`);

  try {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    });

    console.log("All files deleted successfully.");
  } catch (error) {
    if (error.code === "EBUSY") {
      console.error(
        `The directory or file is busy or locked: ${error.path}. Ensure no other process is using it and try again.`
      );
    } else {
      console.error(`Error deleting files: ${error.message}`);
    }
  }
};
