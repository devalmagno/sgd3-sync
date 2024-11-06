const fs = require("fs");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

async function main() {
  const options = new chrome.Options();

  // Set the path to your user data (profile) directory
  options.addArguments("--user-data-dir=/home/depto/.config/google-chrome"); // Path to Chrome's user data directory
  options.addArguments("--profile-directory=Default"); // The specific profile (usually "Default")
  options.addArguments("--user-data-dir=/tmp/chrome-selenium-profile");

  // Additional settings to avoid common issues
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--disable-gpu");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  let teachers = getTeachersFromJson();

  try {
    teachers = await getCourseId(teachers, driver);
    await updateTeacherData(teachers, driver);
    driver.quit();
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    // Keep the browser open for observation or debugging
    // await driver.quit();
  }
}

function getTeachersFromJson() {
  let teachers = [];
  const filePath = "./files/input.json";
  try {
    const data = fs.readFileSync(filePath, "utf8");
    teachers = JSON.parse(data);
  } catch (error) {
    console.error("Error reading JSON file:", error);
  }

  return teachers;
}

async function getCourseId(teachers, driver) {
  let formatedTeachers = [];
  await driver.get(
    "https://www.sgd3.unimontes.br/relatorios/disciplinas/professor?filtrar_por=curso"
  );

  let selectElement = await driver.wait(
    until.elementLocated(By.xpath('//*[@id="dadosFiltragem"]')),
    10000
  );
  let options = await selectElement.findElements(By.css("option"));
  let courseAndId = [];
  for (const option of options) {
    const text = await option.getText();
    let value = await option.getAttribute("value");
    courseAndId.push({ text, value });
  }

  for (let teacher of teachers) {
    const disciplines = teacher.disciplines;
    let disciplinesWithCourseId = [];
    for (let discipline of disciplines) {
      const courseName = discipline.course;
      courseAndId.forEach((course) => {
        if (course.text === courseName) {
          discipline.courseId = course.value;
          disciplinesWithCourseId.push(discipline);
        }
      });
    }

    teacher.disciplines = disciplinesWithCourseId;
    formatedTeachers.push(teacher);
  }

  return formatedTeachers;
}

async function updateTeacherData(teachers, driver) {
  for (let teacher of teachers) {
    await driver.get("https://www.sgd3.unimontes.br/cadastro/professores");
    let login = teacher.login;

    let searchInput = await driver.wait(
      until.elementLocated(By.xpath("/html/body/div[3]/div/form/input")),
      10000
    );
    await searchInput.clear();
    await searchInput.sendKeys(login);

    let searchBtn = await driver.wait(
      until.elementLocated(By.xpath("/html/body/div[3]/div/form/button")),
      10000
    );
    await searchBtn.click();
    await driver.sleep(1000);

    let sucess = await openTeacherPage(driver);
    if (!sucess) continue;
    await checkTeacherData(driver, teacher);
    await addPlanTime(driver);
    await addDisciplines(driver, teacher);
  }
}

async function openTeacherPage(driver, index = 0) {
  let sucess = false;
  // AddBtn + index
  try {
    let addBtn = await driver.wait(
      until.elementLocated(
        By.xpath(`/html/body/div[3]/div/table/tbody/tr[2]/td[6]/button`)
      ),
      1000
    );

    sucess = true;
    await addBtn.click();
  } catch (err) {}

  if (sucess) return sucess;

  // AddBtn - index

  try {
    let addBtn = await driver.wait(
      until.elementLocated(
        By.xpath(`/html/body/div[3]/div/table/tbody/tr/td[6]/button`)
      ),
      1000
    );

    sucess = true;
    await addBtn.click();
  } catch (err) {}

  if (sucess) return sucess;

  // planBtn + index
  try {
    let planBtn = await driver.wait(
      until.elementLocated(
        By.xpath(`/html/body/div[3]/div/table/tbody/tr[2]/td[6]/a[2]`)
      ),
      100
    );

    sucess = true;
    await planBtn.click();
  } catch (err) {}

  if (sucess) return sucess;

  // planBtn - index
  try {
    let planBtn = await driver.wait(
      until.elementLocated(
        By.xpath(`/html/body/div[3]/div/table/tbody/tr/td[6]/a[2]`)
      ),
      100
    );

    await planBtn.click();
  } catch (err) {}

  return sucess;
}

async function addPlanTime(driver) {
  let initialDateInput = await driver.wait(
    until.elementLocated(By.xpath('//*[@id="inicio"]')),
    1000
  );
  const alreadyExists = await initialDateInput.getAttribute("value");
  if (alreadyExists) return;

  await initialDateInput.clear();
  await initialDateInput.sendKeys("01/02/2025");
  let endDateInput = await driver.wait(
    until.elementLocated(By.xpath('//*[@id="termino"]')),
    1000
  );
  await endDateInput.clear();
  await endDateInput.sendKeys("31/07/2025");

  let saveBtn = await driver.wait(
    until.elementLocated(By.xpath('//*[@id="salvar-dados-complementares"]')),
    1000
  );
  await saveBtn.click();
  await driver.sleep(1000);
}
async function checkTeacherData(driver, teacher) {
  let formatedName = teacher.name
    .split(" ")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let teacherNameElement = await driver.wait(
    until.elementLocated(By.xpath("/html/body/nav[2]/ol/li[3]/a")),
    1000
  );
  let name = await teacherNameElement.getText();
  let normalizedName = name
    .split(" ")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedName !== formatedName) {
    console.log(normalizedName, teacher.name);
    let index = 2;
    await driver.navigate().back();
    await driver.sleep(1000);
    await openTeacherPage(driver, index);
    await checkTeacherData(driver, teacher);
  } else {
    console.log(`Abrindo o plano de trabalho de ${teacher.name}.`);
  }
}

async function addDisciplines(driver, teacher) {
  let disciplinesPage = await driver.wait(
    until.elementLocated(By.xpath('//*[@id="disciplinas-tab"]')),
    100
  );
  disciplinesPage.click();
  await driver.sleep(1000);

  let addBtn = await driver.wait(
    until.elementLocated(
      By.xpath('//*[@id="disciplinas"]/fieldset/div/button')
    ),
    100
  );

  for (let discipline of teacher.disciplines) {
    let index = teacher.disciplines.indexOf(discipline);
    let indexOfElement = index == 0 ? "" : `[${index + 1}]`;
    addBtn.click();
    await driver.sleep(500);
    let editBtn = await driver.wait(
      until.elementLocated(
        By.xpath(
          `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[8]/button`
        )
      ),
      100
    );
    try {
      await editBtn.click();
      await driver.sleep(100);

      await selectOption(
        driver,
        `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[1]/select`,
        discipline.courseId
      );
      await selectOption(
        driver,
        `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[2]/select`,
        discipline.period
      );
      await selectOption(
        driver,
        `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[3]/select`,
        `${discipline.id}|${discipline.grade}`
      );
      await selectOption(
        driver,
        `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[4]/select`,
        discipline.je ? "JE" : "CE"
      );
      await selectOption(
        driver,
        `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[5]/select`,
        "M"
      );
      await driver.sleep(1000);

      let saveBtn = await driver.wait(
        until.elementLocated(
          By.xpath(
            `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[8]/button`
          )
        ),
        100
      );
      saveBtn.click();
      console.log(`Disciplina ${discipline.name} adicionada com sucesso.`);
    } catch (err) {
      let deleteBtn = await driver.wait(
        until.elementLocated(
          By.xpath(
            `/html/body/div[3]/div/div[4]/div[2]/fieldset/div/table/tbody/tr${indexOfElement}/td[9]/button`
          )
        ),
        100
      );
      await deleteBtn.click();
    }
    await driver.sleep(1000);
  }
}

async function selectOption(driver, element, attribute) {
  let selectElement = await driver.wait(
    until.elementLocated(By.xpath(element)),
    10000
  );
  let options = await selectElement.findElements(By.css("option"));
  for (let option of options) {
    const value = await option.getAttribute("value");
    if (value === attribute) {
      await option.click();
      break;
    }
  }
  await driver.sleep(300);
}

main();
