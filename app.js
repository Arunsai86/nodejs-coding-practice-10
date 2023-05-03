const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertStateDbToResponseDate = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const convertDistrictDataToResponseData = (Obj) => {
  return {
    districtId: Obj.district_id,
    districtName: Obj.district_name,
    stateId: Obj.state_id,
    cases: Obj.cases,
    cured: Obj.cured,
    active: Obj.active,
    deaths: Obj.deaths,
  };
};

const convertTotalStatusToResponseStatus = (Obj) => {
  return {
    totalCases: Obj.total_cases,
    totalCured: Obj.total_cured,
    totalActive: Obj.total_active,
    totalDeaths: Obj.total_deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT * FROM user WHERE username = "${username}";
    `;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordValidate = await bcrypt.compare(password, dbUser.password);
    if (isPasswordValidate === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;
    `;
  const states = await db.all(getStatesQuery);
  response.send(
    states.map((eachState) => convertStateDbToResponseDate(eachState))
  );
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const state = await db.get(getStateQuery);
  response.send(convertStateDbToResponseDate(state));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictsQuery = `
    INSERT INTO district (district_name,state_id,cases, cured, active, deaths)
    VALUES ("${districtName}", ${stateId}, ${cases}, ${cured} , ${active}, ${deaths})
    `;
  await db.run(postDistrictsQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT * FROM district WHERE district_id = ${districtId}
  `;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictDataToResponseData(district));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
  DELETE FROM district WHERE district_id = ${districtId}
  `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE district
    SET district_name = "${districtName}", 
    state_id = "${stateId}", 
    cases = "${cases}", 
    cured = "${cured}" , 
    active = "${active}", 
    deaths = "${deaths}"
    WHERE district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalStatusQuery = `
    SELECT SUM(cases) AS total_cases,
    SUM(cured) AS total_cured,
    SUM(active) AS total_active,
    SUM(deaths) AS total_deaths FROM district WHERE state_id = ${stateId}
  `;
    const result = await db.get(getTotalStatusQuery);
    response.send(convertTotalStatusToResponseStatus(result));
  }
);

module.exports = app;
