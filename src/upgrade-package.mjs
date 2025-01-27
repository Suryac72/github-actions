import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";

// Function to update package version
function updatePackageVersion(packageName, newVersion) {
  // Declare updateNestedDependencies at the root level of the function body
  let nestedUpdated = false;
  function updateNestedDependencies(dependencies, parentName = "") {
    for (const [depName, depDetails] of Object.entries(dependencies || {})) {
      if (parentName.startsWith("@makemydeal")) {
        console.log(
          chalk.yellow(
            `⚠️ Skipping update for ${depName} as its parent (${parentName}) starts with @makemydeal.`
          )
        );
        continue;
      }

      if (depName === packageName && depDetails.version !== newVersion) {
        depDetails.version = newVersion;
        nestedUpdated = true;
        console.log(
          chalk.green(
            `✔ Updated nested dependency ${packageName} in package-lock.json.`
          )
        );
      }

      // Recursively handle nested dependencies
      if (depDetails.dependencies) {
        updateNestedDependencies(depDetails.dependencies, depName);
      }
    }
  }

  try {
    console.log(
      chalk.blue(`Updating ${packageName} to version ${newVersion}...`)
    );

    const packageJsonPath = path.resolve("package.json");
    const packageLockPath = path.resolve("package-lock.json");

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error("package.json not found in the current directory.");
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    // Update dependencies or devDependencies
    let updated = false;
    ["dependencies", "devDependencies"].forEach((depType) => {
      if (packageJson[depType] && packageJson[depType][packageName]) {
        packageJson[depType][packageName] = newVersion;
        updated = true;
        console.log(chalk.green(`✔ Updated ${packageName} in ${depType}.`));
      }
    });

    if (!updated) {
      console.log(
        chalk.yellow(
          `⚠️ ${packageName} is not listed in dependencies or devDependencies.`
        )
      );
    }

    // Write updated package.json
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf8"
    );

    // If package-lock.json exists, update nested dependencies
    if (fs.existsSync(packageLockPath)) {
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"));

      updateNestedDependencies(packageLock.dependencies);

      if (nestedUpdated) {
        fs.writeFileSync(
          packageLockPath,
          JSON.stringify(packageLock, null, 2),
          "utf8"
        );
        console.log(chalk.green("✔ package-lock.json updated successfully."));
      }
    }

    // Skip `npm install` if no direct dependencies were updated
    if (updated) {
      console.log(
        chalk.blue("Running npm install to sync package-lock.json...")
      );
      execSync("npm install", { stdio: "inherit" });
    } else {
      console.log(
        chalk.yellow(
          `⚠️ Skipping npm install because ${packageName} is not a direct dependency in package.json.`
        )
      );
    }
  } catch (err) {
    console.error(chalk.red("Error updating package version:"), err.message);
  }
}

// Command-line arguments
const [packageName, newVersion] = process.argv.slice(2);

if (!packageName || !newVersion) {
  console.error(
    chalk.red("Usage: node updatePackage.js <package-name> <new-version>")
  );
  process.exit(1);
}

updatePackageVersion(packageName, newVersion);
