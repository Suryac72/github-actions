import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Function to execute shell commands
function executeCommand(command, errorMessage) {
    try {
        execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(chalk.red(errorMessage), error.message);
        process.exit(1);
    }
}

// Function to update package version
function updatePackageVersion(packageName, newVersion) {
    let nestedUpdated = false;
    let packageUpdated = false;

    // Function to check if any parent includes @makemydeal or @coxauto
    function isParentMakemydeal(parentName) {
        return parentName.includes('@makemydeal') || parentName.includes('@coxauto');
    }

    // Function to update the version of the parent that uses the child package
    function updateParentVersion(dependencies, parentName = '') {
        for (const [depName, depDetails] of Object.entries(dependencies || {})) {
            if (isParentMakemydeal(parentName)) {
                console.log(
                    chalk.yellow(`⚠️  Skipping update for ${depName} as its parent (${parentName}) starts with @makemydeal.`)
                );
                continue;
            }

            if (depName === packageName && depDetails.version !== newVersion) {
                depDetails.version = newVersion;
                nestedUpdated = true;
                console.log(chalk.green(`✔ Updated ${packageName} to version ${newVersion} in ${parentName}.`));
            }

            if (depDetails.dependencies) {
                updateParentVersion(depDetails.dependencies, depName);
            }
        }
    }

    try {
        console.log(chalk.blue(`Updating ${packageName} to version ${newVersion}...`));

        const packageJsonPath = path.resolve('package.json');
        const packageLockPath = path.resolve('package-lock.json');

        if (!fs.existsSync(packageJsonPath)) {
            throw new Error('package.json not found in the current directory.');
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // Check for direct dependency in package.json
        let updated = false;
        ['dependencies', 'devDependencies'].forEach((depType) => {
            if (packageJson[depType] && packageJson[depType][packageName]) {
                if (packageJson[depType][packageName] === newVersion) {
                    console.log(chalk.green(`✔ ${packageName} is already at version ${newVersion} in ${depType}.`));
                } else {
                    packageJson[depType][packageName] = newVersion;
                    updated = true;
                    packageUpdated = true;
                    console.log(chalk.green(`✔ Updated ${packageName} to ${newVersion} in ${depType}.`));
                }
            }
        });

        if (!updated) {
            console.log(chalk.yellow(`⚠️  ${packageName} is not listed in dependencies or devDependencies.`));
        }

        if (packageUpdated) {
            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        }

        if (fs.existsSync(packageLockPath)) {
            const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
            updateParentVersion(packageLock.dependencies);

            if (nestedUpdated) {
                fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2), 'utf8');
                console.log(chalk.green('✔ package-lock.json updated successfully.'));
            } else {
                console.log(chalk.green('✔ No updates needed for package-lock.json.'));
            }
        }

        if (updated || nestedUpdated) {
            console.log(chalk.blue('Running npm install to sync package-lock.json...'));
            executeCommand('npm install', 'Failed to run npm install');
        } else {
            console.log(chalk.yellow(`⚠️  Skipping npm install because ${packageName} was not updated.`));
        }

    } catch (err) {
        console.error(chalk.red('Error updating package version:'), err.message);
    }
}

// Function to create a branch, commit changes, and push to remote
function createBranchAndPush() {
    try {
         // Configure Git user details
        executeCommand('git config --global user.name "github-actions[bot]"');
        executeCommand('git config --global user.email "github-actions[bot]@users.noreply.github.com"');

        // Generate a branch name dynamically
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15);
        const branchName = `update-packages-${timestamp}`;

        console.log(chalk.blue(`Creating and switching to branch: ${branchName}`));
        executeCommand(`git checkout -b ${branchName}`, 'Failed to create a new branch.');

        console.log(chalk.blue('Staging changes...'));
        executeCommand('git add package.json package-lock.json', 'Failed to stage changes.');

        console.log(chalk.blue('Committing changes...'));
        executeCommand('git commit -m "chore: update package versions"', 'Failed to commit changes.');

        console.log(chalk.blue('Pushing changes to remote...'));
        executeCommand(`git push --set-upstream origin ${branchName}`, 'Failed to push changes to remote.');

        console.log(chalk.green('✔ Changes pushed successfully.'));
        
        // Output the branch name for use in the GitHub workflow
        process.stdout.write(`::set-output name=branch-name::${branchName}\n`);
    } catch (err) {
        console.error(chalk.red('Error during Git operations:'), err.message);
    }
}

// Command-line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.length % 2 !== 0) {
    console.error(
        chalk.red('Usage: node updatePackage.js <package-name-1> <new-version-1> [<package-name-2> <new-version-2> ...]')
    );
    process.exit(1);
}

// Process each package-version pair
for (let i = 0; i < args.length; i += 2) {
    const packageName = args[i];
    const newVersion = args[i + 1];
    updatePackageVersion(packageName, newVersion);
}

// Create the branch and push changes
createBranchAndPush();
