/**
 * Init Command - Initialize CWIM in a project
 * Generates a smart CLAUDE.md based on project type detection
 */

import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';

interface InitOptions {
  projectPath: string;
}

type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'ruby' | 'php' | 'java' | 'dotnet' | 'generic';

interface ProjectInfo {
  type: ProjectType;
  name: string;
  techStack: string[];
  keyFiles: string[];
  conventions: string[];
}

const TEMPLATES: Record<ProjectType, string> = {
  node: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Runtime:** Node.js
- **Framework:** {FRAMEWORK}
- **Language:** TypeScript/JavaScript
- **Package Manager:** {PACKAGE_MANAGER}
- **Testing:** {TEST_FRAMEWORK}

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Build output: {BUILD_DIR}

## Code Conventions
- Use async/await over callbacks
- Prefer const/let over var
- Follow the project's ESLint/Prettier config
- Use TypeScript strict mode where possible
- Import order: built-ins → external → internal → relative

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`npm run dev\\\` or \\\`pnpm dev\\\` for development server
- Run \\\`npm test\\\` to execute tests
- Check package.json scripts for available commands
`,

  python: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** Python {PYTHON_VERSION}
- **Framework:** {FRAMEWORK}
- **Package Manager:** {PACKAGE_MANAGER}
- **Testing:** {TEST_FRAMEWORK}
- **Type Checking:** {TYPE_CHECKER}

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Virtual environment: {VENV}

## Code Conventions
- Follow PEP 8 style guide
- Use type hints where possible
- Prefer f-strings over .format() or %
- Use pathlib for file operations
- Keep functions focused and under 50 lines

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`python -m pytest\\\` for tests
- Activate virtual environment before running
- Use \\\`pip install -r requirements.txt\\\` or \\\`poetry install\\\` for dependencies
`,

  rust: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** Rust
- **Build Tool:** Cargo
- **Testing:** Built-in test framework
- **Type System:** Strong static typing with ownership

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Dependencies: Defined in Cargo.toml

## Code Conventions
- Follow Rust naming conventions (snake_case for functions/variables)
- Handle errors with Result/Option, avoid unwrap() in production code
- Use cargo fmt and cargo clippy
- Prefer iterators over loops where possible
- Keep functions small and composable

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`cargo build\\\` to compile
- Run \\\`cargo test\\\` for tests
- Run \\\`cargo run\\\` to execute
- Check Cargo.toml for features and dependencies
`,

  go: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** Go
- **Module System:** Go Modules
- **Testing:** Built-in testing package
- **Formatting:** gofmt

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Module: Defined in go.mod

## Code Conventions
- Follow Go formatting with gofmt
- Use explicit error handling (if err != nil)
- Keep packages focused and small
- Use interfaces for testability
- Prefer composition over inheritance

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`go run .\\\` to execute
- Run \\\`go test ./...\\\` for all tests
- Run \\\`go mod tidy\\\` to clean dependencies
- Check go.mod for module path and dependencies
`,

  ruby: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** Ruby
- **Framework:** {FRAMEWORK}
- **Package Manager:** Bundler
- **Testing:** {TEST_FRAMEWORK}

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Dependencies: Defined in Gemfile

## Code Conventions
- Follow Ruby style guide
- Use descriptive method names
- Prefer inject/map/select over loops
- Keep methods under 10 lines when possible
- Use symbols over strings for identifiers

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`bundle install\\\` to install dependencies
- Run \\\`bundle exec rspec\\\` or \\\`bundle exec rake test\\\` for tests
- Run \\\`ruby {ENTRY_POINT}\\\` to execute
`,

  php: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** PHP
- **Framework:** {FRAMEWORK}
- **Package Manager:** Composer
- **Testing:** {TEST_FRAMEWORK}

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Dependencies: Defined in composer.json

## Code Conventions
- Follow PSR standards (PSR-1, PSR-2, PSR-12)
- Use type declarations where possible
- Prefer dependency injection
- Use namespaces properly
- Keep controllers thin, business logic in services

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`composer install\\\` to install dependencies
- Run \\\`vendor/bin/phpunit\\\` for tests
- Check composer.json for scripts and dependencies
`,

  java: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** Java
- **Build Tool:** {BUILD_TOOL}
- **Framework:** {FRAMEWORK}
- **Testing:** {TEST_FRAMEWORK}

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Build directory: {BUILD_DIR}

## Code Conventions
- Follow Java naming conventions
- Use dependency injection
- Prefer immutability where possible
- Handle exceptions appropriately
- Keep methods focused and under 30 lines

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`{BUILD_CMD}\\\` to build
- Run \\\`{TEST_CMD}\\\` for tests
- Check pom.xml or build.gradle for dependencies
`,

  dotnet: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
- **Language:** C# / .NET
- **Framework:** {FRAMEWORK}
- **Build Tool:** dotnet CLI
- **Testing:** xUnit / NUnit / MSTest

## Architecture
- Entry point: {ENTRY_POINT}
- Source directory: {SRC_DIR}
- Solution: {SOLUTION_FILE}

## Code Conventions
- Follow C# naming conventions
- Use async/await for asynchronous operations
- Prefer LINQ over loops where readable
- Use dependency injection
- Keep classes focused (Single Responsibility)

## Key Files
{KEY_FILES}

## Context Notes
- Run \\\`dotnet build\\\` to compile
- Run \\\`dotnet test\\\` for tests
- Run \\\`dotnet run\\\` to execute
- Use \\\`dotnet add package\\\` to add dependencies
`,

  generic: `# {PROJECT_NAME}

## Project Overview
{PROJECT_DESCRIPTION}

## Tech Stack
<!-- Detected from project files -->
{TECH_STACK}

## Architecture
<!-- Add your architecture notes here -->

## Code Conventions
<!-- Add your team's coding standards -->
- Keep functions small and focused
- Use meaningful variable names
- Add comments for complex logic
- Follow existing patterns in the codebase

## Key Files
{KEY_FILES}

## Context Notes
<!-- Add any project-specific context Claude should remember -->
- This project was initialized with CWIM
- Update this file as the project evolves
- Keep it concise - every token counts
`,
};

export class InitCommand {
  async execute(options: InitOptions): Promise<void> {
    const projectPath = resolve(options.projectPath);

    console.log('');
    console.log(chalk.bold.cyan('  CWIM Project Initialization'));
    console.log(`  ${chalk.gray(projectPath)}`);
    console.log('');

    // Detect project type and info
    const projectInfo = this.detectProject(projectPath);

    // Check for existing CLAUDE.md
    const claudeMdPath = join(projectPath, 'CLAUDE.md');
    if (!existsSync(claudeMdPath)) {
      const content = this.generateClaudeMd(projectInfo, projectPath);
      writeFileSync(claudeMdPath, content);
      console.log(`  ${chalk.green('✓')} Created ${chalk.cyan('CLAUDE.md')} (${chalk.yellow(`~${this.estimateTokens(content)} tokens`)} when loaded)`);
    } else {
      console.log(`  ${chalk.yellow('○')} ${chalk.cyan('CLAUDE.md')} already exists`);
    }

    // Summary
    console.log('');
    console.log(chalk.bold('  Project Detected:'));
    console.log(`    Type:    ${chalk.cyan(projectInfo.type)}`);
    console.log(`    Name:    ${chalk.cyan(projectInfo.name)}`);
    if (projectInfo.techStack.length > 0) {
      console.log(`    Stack:   ${chalk.cyan(projectInfo.techStack.join(', '))}`);
    }
    console.log('');

    // Next steps
    console.log(chalk.bold('  Next Steps:'));
    console.log(`    1. Edit ${chalk.cyan('CLAUDE.md')} with your project-specific context`);
    console.log(`    2. Run ${chalk.cyan('cwim dashboard')} to monitor context usage`);
    console.log(`    3. Run ${chalk.cyan('cwim check')} to analyze your project files`);
    console.log('');

    // Tips
    console.log(chalk.gray('  Tips:'));
    console.log(chalk.gray('    • Keep CLAUDE.md under 500 tokens for efficiency'));
    console.log(chalk.gray('    • Use bullet points over prose'));
    console.log(chalk.gray('    • Update CLAUDE.md as your project evolves'));
    console.log(chalk.gray('    • Place critical instructions at the top'));
    console.log('');
  }

  /**
   * Detect project type by examining files
   */
  private detectProject(projectPath: string): ProjectInfo {
    const name = basename(projectPath);
    let type: ProjectType = 'generic';
    const techStack: string[] = [];
    const keyFiles: string[] = [];
    const conventions: string[] = [];

    // Node.js detection
    if (existsSync(join(projectPath, 'package.json'))) {
      type = 'node';
      techStack.push('Node.js');
      keyFiles.push('package.json');

      try {
        const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'));
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          techStack.push('React');
        }
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
          techStack.push('Vue');
        }
        if (pkg.dependencies?.next) {
          techStack.push('Next.js');
        }
        if (pkg.dependencies?.nuxt) {
          techStack.push('Nuxt');
        }
        if (pkg.dependencies?.express) {
          techStack.push('Express');
        }
        if (pkg.devDependencies?.typescript) {
          techStack.push('TypeScript');
        }
        if (pkg.dependencies?.prisma || pkg.devDependencies?.prisma) {
          techStack.push('Prisma');
        }
      } catch {
        // Ignore parse errors
      }

      if (existsSync(join(projectPath, 'tsconfig.json'))) {
        keyFiles.push('tsconfig.json');
      }
      if (existsSync(join(projectPath, 'vite.config.ts')) || existsSync(join(projectPath, 'vite.config.js'))) {
        keyFiles.push('vite.config.*');
      }
    }

    // Python detection
    else if (existsSync(join(projectPath, 'requirements.txt')) || existsSync(join(projectPath, 'pyproject.toml'))) {
      type = 'python';
      techStack.push('Python');
      keyFiles.push('requirements.txt or pyproject.toml');

      if (existsSync(join(projectPath, 'poetry.lock'))) {
        techStack.push('Poetry');
      }
      if (existsSync(join(projectPath, 'Pipfile'))) {
        techStack.push('Pipenv');
      }
      if (existsSync(join(projectPath, 'manage.py'))) {
        techStack.push('Django');
        keyFiles.push('manage.py');
      }
      if (existsSync(join(projectPath, 'app.py')) || existsSync(join(projectPath, 'main.py'))) {
        keyFiles.push('app.py / main.py');
      }
    }

    // Rust detection
    else if (existsSync(join(projectPath, 'Cargo.toml'))) {
      type = 'rust';
      techStack.push('Rust');
      keyFiles.push('Cargo.toml');
      keyFiles.push('src/main.rs or src/lib.rs');
    }

    // Go detection
    else if (existsSync(join(projectPath, 'go.mod'))) {
      type = 'go';
      techStack.push('Go');
      keyFiles.push('go.mod');
      keyFiles.push('main.go');
    }

    // Ruby detection
    else if (existsSync(join(projectPath, 'Gemfile'))) {
      type = 'ruby';
      techStack.push('Ruby');
      keyFiles.push('Gemfile');

      if (existsSync(join(projectPath, 'config.ru'))) {
        techStack.push('Rack/Sinatra');
      }
      if (existsSync(join(projectPath, 'config/application.rb'))) {
        techStack.push('Rails');
      }
    }

    // PHP detection
    else if (existsSync(join(projectPath, 'composer.json'))) {
      type = 'php';
      techStack.push('PHP');
      keyFiles.push('composer.json');

      if (existsSync(join(projectPath, 'artisan'))) {
        techStack.push('Laravel');
        keyFiles.push('artisan');
      }
    }

    // Java detection
    else if (existsSync(join(projectPath, 'pom.xml')) || existsSync(join(projectPath, 'build.gradle'))) {
      type = 'java';
      techStack.push('Java');
      keyFiles.push(existsSync(join(projectPath, 'pom.xml')) ? 'pom.xml' : 'build.gradle');

      if (existsSync(join(projectPath, 'src/main/java'))) {
        keyFiles.push('src/main/java/');
      }
    }

    // .NET detection
    else if (existsSync(join(projectPath, '.csproj')) || this.findFile(projectPath, '.csproj') || this.findFile(projectPath, '.sln')) {
      type = 'dotnet';
      techStack.push('.NET / C#');
      keyFiles.push('*.csproj');
    }

    return {
      type,
      name,
      techStack,
      keyFiles,
      conventions,
    };
  }

  /**
   * Find a file by extension in directory
   */
  private findFile(projectPath: string, extension: string): boolean {
    try {
      const files = require('fs').readdirSync(projectPath);
      return files.some((f: string) => f.endsWith(extension));
    } catch {
      return false;
    }
  }

  /**
   * Generate CLAUDE.md content based on project info
   */
  private generateClaudeMd(info: ProjectInfo, projectPath: string): string {
    const template = TEMPLATES[info.type];

    // Common replacements
    let content = template
      .replace(/{PROJECT_NAME}/g, info.name)
      .replace(/{PROJECT_DESCRIPTION}/g, `A ${info.type} project named ${info.name}`)
      .replace(/{TECH_STACK}/g, info.techStack.length > 0
        ? info.techStack.map(t => `- ${t}`).join('\n')
        : '- Add your tech stack here');

    // Type-specific replacements
    switch (info.type) {
      case 'node': {
        const pkgPath = join(projectPath, 'package.json');
        let framework = 'Vanilla Node.js';
        let packageManager = 'npm';
        let testFramework = 'Jest or Vitest';
        let entryPoint = 'index.js or index.ts';
        let srcDir = 'src/';
        let buildDir = 'dist/ or build/';

        if (existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            if (pkg.dependencies?.next) framework = 'Next.js';
            else if (pkg.dependencies?.nuxt) framework = 'Nuxt';
            else if (pkg.dependencies?.react) framework = 'React';
            else if (pkg.dependencies?.vue) framework = 'Vue';
            else if (pkg.dependencies?.express) framework = 'Express';
            else if (pkg.dependencies?.fastify) framework = 'Fastify';

            if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
            else if (existsSync(join(projectPath, 'yarn.lock'))) packageManager = 'Yarn';
            else if (existsSync(join(projectPath, 'bun.lockb'))) packageManager = 'Bun';

            if (pkg.devDependencies?.vitest) testFramework = 'Vitest';
            else if (pkg.devDependencies?.jest) testFramework = 'Jest';
            else if (pkg.devDependencies?.mocha) testFramework = 'Mocha';
            else if (pkg.devDependencies?.ava) testFramework = 'AVA';

            if (pkg.main) entryPoint = pkg.main;
            else if (existsSync(join(projectPath, 'src/index.ts'))) entryPoint = 'src/index.ts';
            else if (existsSync(join(projectPath, 'src/index.js'))) entryPoint = 'src/index.js';
            else if (existsSync(join(projectPath, 'index.ts'))) entryPoint = 'index.ts';

            if (pkg.scripts?.build?.includes('tsc')) buildDir = 'dist/';
            else if (pkg.scripts?.build?.includes('vite')) buildDir = 'dist/';
          } catch {
            // Use defaults
          }
        }

        if (existsSync(join(projectPath, 'src'))) srcDir = 'src/';
        else if (existsSync(join(projectPath, 'lib'))) srcDir = 'lib/';

        content = content
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{PACKAGE_MANAGER}/g, packageManager)
          .replace(/{TEST_FRAMEWORK}/g, testFramework)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir)
          .replace(/{BUILD_DIR}/g, buildDir);
        break;
      }

      case 'python': {
        let framework = 'Vanilla Python';
        let packageManager = 'pip';
        let testFramework = 'pytest';
        let typeChecker = 'None';
        let entryPoint = 'main.py';
        let srcDir = '.';
        let venv = '.venv or venv/';

        if (existsSync(join(projectPath, 'poetry.lock'))) packageManager = 'Poetry';
        else if (existsSync(join(projectPath, 'Pipfile'))) packageManager = 'Pipenv';
        else if (existsSync(join(projectPath, 'uv.lock'))) packageManager = 'uv';

        if (existsSync(join(projectPath, 'manage.py'))) framework = 'Django';
        else if (existsSync(join(projectPath, 'app.py'))) {
          if (existsSync(join(projectPath, 'requirements.txt'))) {
            try {
              const req = readFileSync(join(projectPath, 'requirements.txt'), 'utf-8');
              if (req.includes('flask')) framework = 'Flask';
              else if (req.includes('fastapi')) framework = 'FastAPI';
              else if (req.includes('django')) framework = 'Django';
            } catch {
              // Use default
            }
          }
        }

        if (existsSync(join(projectPath, 'pyproject.toml'))) {
          try {
            const pyproject = readFileSync(join(projectPath, 'pyproject.toml'), 'utf-8');
            if (pyproject.includes('mypy')) typeChecker = 'mypy';
            else if (pyproject.includes('pyright')) typeChecker = 'Pyright';
          } catch {
            // Use default
          }
        }

        if (existsSync(join(projectPath, 'src'))) {
          srcDir = 'src/';
        }

        content = content
          .replace(/{PYTHON_VERSION}/g, '3.x')
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{PACKAGE_MANAGER}/g, packageManager)
          .replace(/{TEST_FRAMEWORK}/g, testFramework)
          .replace(/{TYPE_CHECKER}/g, typeChecker)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir)
          .replace(/{VENV}/g, venv);
        break;
      }

      case 'rust': {
        let entryPoint = 'src/main.rs';
        let srcDir = 'src/';

        if (existsSync(join(projectPath, 'src/lib.rs')) && !existsSync(join(projectPath, 'src/main.rs'))) {
          entryPoint = 'src/lib.rs';
        }

        content = content
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir);
        break;
      }

      case 'go': {
        let entryPoint = 'main.go';
        let srcDir = '.';

        if (existsSync(join(projectPath, 'cmd'))) {
          entryPoint = 'cmd/*/main.go';
        }

        content = content
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir);
        break;
      }

      case 'ruby': {
        let framework = 'Vanilla Ruby';
        let testFramework = 'RSpec';
        let entryPoint = 'app.rb or main.rb';
        let srcDir = 'lib/';

        if (existsSync(join(projectPath, 'config.ru'))) framework = 'Sinatra/Rack';
        if (existsSync(join(projectPath, 'config/application.rb'))) framework = 'Rails';

        if (existsSync(join(projectPath, 'test'))) testFramework = 'Minitest';
        if (existsSync(join(projectPath, 'spec'))) testFramework = 'RSpec';

        content = content
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{TEST_FRAMEWORK}/g, testFramework)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir);
        break;
      }

      case 'php': {
        let framework = 'Vanilla PHP';
        let testFramework = 'PHPUnit';
        let entryPoint = 'index.php';
        let srcDir = 'src/ or app/';

        if (existsSync(join(projectPath, 'artisan'))) framework = 'Laravel';
        if (existsSync(join(projectPath, 'composer.json'))) {
          try {
            const composer = JSON.parse(readFileSync(join(projectPath, 'composer.json'), 'utf-8'));
            if (composer.require?.['symfony/framework-bundle']) framework = 'Symfony';
          } catch {
            // Use default
          }
        }

        content = content
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{TEST_FRAMEWORK}/g, testFramework)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir);
        break;
      }

      case 'java': {
        let buildTool = 'Maven';
        let framework = 'Vanilla Java';
        let testFramework = 'JUnit';
        let entryPoint = 'src/main/java/App.java';
        let srcDir = 'src/main/java/';
        let buildDir = 'target/';
        let buildCmd = 'mvn compile';
        let testCmd = 'mvn test';

        if (existsSync(join(projectPath, 'build.gradle'))) {
          buildTool = 'Gradle';
          buildDir = 'build/';
          buildCmd = './gradlew build';
          testCmd = './gradlew test';
        }

        if (existsSync(join(projectPath, 'pom.xml'))) {
          try {
            const pom = readFileSync(join(projectPath, 'pom.xml'), 'utf-8');
            if (pom.includes('spring-boot')) framework = 'Spring Boot';
          } catch {
            // Use default
          }
        }

        content = content
          .replace(/{BUILD_TOOL}/g, buildTool)
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{TEST_FRAMEWORK}/g, testFramework)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir)
          .replace(/{BUILD_DIR}/g, buildDir)
          .replace(/{BUILD_CMD}/g, buildCmd)
          .replace(/{TEST_CMD}/g, testCmd);
        break;
      }

      case 'dotnet': {
        let framework = '.NET Core / .NET 5+';
        let entryPoint = 'Program.cs';
        let srcDir = '.';
        let solutionFile = 'None (single project)';

        const files = require('fs').readdirSync(projectPath);
        const slnFile = files.find((f: string) => f.endsWith('.sln'));
        if (slnFile) solutionFile = slnFile;

        content = content
          .replace(/{FRAMEWORK}/g, framework)
          .replace(/{ENTRY_POINT}/g, entryPoint)
          .replace(/{SRC_DIR}/g, srcDir)
          .replace(/{SOLUTION_FILE}/g, solutionFile);
        break;
      }
    }

    // Replace key files
    const keyFilesStr = info.keyFiles.length > 0
      ? info.keyFiles.map(f => `- ${f}`).join('\n')
      : '- Add key files here';

    content = content.replace(/{KEY_FILES}/g, keyFilesStr);

    return content;
  }

  /**
   * Rough token estimate for a string
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
