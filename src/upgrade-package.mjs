import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Function to execute shell commands
function executeCommand(command, errorMessage) {
    console.log(chalk.blue(`Executing command: ${command}`));
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

    // Function to update nested dependencies
    function updateNestedDependencies(dependencies) {
        for (const [depName, depDetails] of Object.entries(dependencies || {})) {
            if (depName === packageName && depDetails.version !== newVersion) {
                depDetails.version = newVersion;
                nestedUpdated = true;
                console.log(chalk.green(`✔ Updated ${packageName} to version ${newVersion} in nested dependencies.`));
            }

            if (depDetails.dependencies) {
                updateNestedDependencies(depDetails.dependencies);
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

        // Update direct dependencies
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
            updateNestedDependencies(packageLock.dependencies);

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
        process.exit(1);
    }
}

// Function to create a branch, commit changes, and push to remote
function createBranchAndPush(packageName, newVersion) {
    try {
        // Configure Git user details
        executeCommand('git config --global user.name "github-actions[bot]"');
        executeCommand('git config --global user.email "github-actions[bot]@users.noreply.github.com"');

        // Generate a branch name dynamically
        const branchName = `update-${packageName}-${newVersion}`;
        console.log(chalk.blue(`Creating and switching to branch: ${branchName}`));
        executeCommand(`git checkout -b ${branchName}`, 'Failed to create a new branch.');

        console.log(chalk.blue('Staging changes...'));
        executeCommand('git add package.json package-lock.json', 'Failed to stage changes.');

        console.log(chalk.blue('Committing changes...'));
        executeCommand('git commit -m "chore: update package version"', 'Failed to commit changes.');

        console.log(chalk.blue('Pushing changes to remote...'));
        executeCommand(`git push --set-upstream origin ${branchName}`, 'Failed to push changes to remote.');

        console.log(chalk.green('✔ Changes pushed successfully.'));

        // Output the branch name for use in GitHub Actions
        console.log(`::set-output name=branch-name::${branchName}`);
    } catch (err) {
        console.error(chalk.red('Error during Git operations:'), err.message);
        process.exit(1);
    }
}

// Command-line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
    console.error(chalk.red('Usage: node upgrade-package.mjs <package-name> <new-version>'));
    process.exit(1);
}

const [packageName, newVersion] = args;

// Process the package update and push changes
updatePackageVersion(packageName, newVersion);
createBranchAndPush(packageName, newVersion);
