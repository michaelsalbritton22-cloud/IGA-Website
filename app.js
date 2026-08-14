const SUPABASE_URL = "https://gvxafuhuxvwjsaeqwlrm.supabase.co";

const SUPABASE_KEY = "sb_publishable_VrKBzTXcDhrGodnR-5GW3Q_Q-u2Azb3";


const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


console.log("IGA Database Connected");

async function loadPlayers() {

    const { data, error } = await supabaseClient
        .from("Players")
        .select("player_id, Name")
        .order("Name");


    if (error) {
        console.log(error);
        return;
    }


    const playerDropdown = document.getElementById("player");

    playerDropdown.innerHTML = "";


    data.forEach(player => {

        playerDropdown.innerHTML += `
            <option value="${player.player_id}">
                ${player.Name}
            </option>
        `;

    });

}



async function loadCourses() {

    const { data, error } = await supabaseClient
        .from("courses")
        .select("course_id, Course_name")
        .order("Course_name");


    if (error) {
        console.log(error);
        return;
    }


    const courseDropdown = document.getElementById("course");

    courseDropdown.innerHTML = "";


    data.forEach(course => {

        courseDropdown.innerHTML += `
            <option value="${course.course_id}">
                ${course.Course_name}
            </option>
        `;

    });

}



loadPlayers();
loadCourses();


const submitRoundButton = document.getElementById("submit_round");

console.log("Submit button found:", submitRoundButton);


submitRoundButton.addEventListener("click", function(){

    console.log("SUBMIT BUTTON CLICKED");

});