document.addEventListener("DOMContentLoaded", () => {

  const modal = document.querySelector(".product-modal");

  if (!modal) return;


  const modalImage = modal.querySelector("[data-modal-image]");
  const modalTitle = modal.querySelector("[data-modal-title]");
  const modalPrice = modal.querySelector("[data-modal-price]");
  const modalDescription = modal.querySelector("[data-modal-description]");
  const modalOptions = modal.querySelector("[data-modal-options]");
  const addButton = modal.querySelector("[data-add-cart]");


  let currentProduct = null;
  let selectedOptions = {};



  /*
    OPEN PRODUCT POPUP
  */

  document.querySelectorAll("[data-open-product]")
    .forEach(button => {


      button.addEventListener("click", () => {


        const card = button.closest(".figma-card");

        const data =
          card.querySelector(".product-json");


        currentProduct =
          JSON.parse(data.textContent);



        modalImage.src =
          currentProduct.image;


        modalTitle.textContent =
          currentProduct.title;


        modalDescription.innerHTML =
          currentProduct.description;



        renderVariants();


        modal.hidden = false;


      });


    });





  /*
    CLOSE MODAL
  */


  document.querySelectorAll("[data-close-modal]")
    .forEach(btn => {


      btn.addEventListener("click", () => {

        modal.hidden = true;

      });


    });







  /*
    RENDER OPTIONS
  */


  function renderVariants(){


    modalOptions.innerHTML = "";

    selectedOptions = {};



    currentProduct.options.forEach(option => {


      const wrapper =
        document.createElement("div");


      wrapper.className =
        "variant-group";



      const title =
        document.createElement("p");


      title.textContent =
        option.name;



      wrapper.appendChild(title);




      option.values.forEach(value => {


        const btn =
          document.createElement("button");


        btn.textContent =
          value;



        btn.className =
          "variant-option";



        btn.addEventListener("click",()=>{


          selectedOptions[option.name] =
            value;



          wrapper
          .querySelectorAll("button")
          .forEach(b =>
            b.classList.remove("active")
          );


          btn.classList.add("active");



          updatePrice();


        });



        wrapper.appendChild(btn);



      });



      modalOptions.appendChild(wrapper);



    });



    updatePrice();


  }






  /*
    FIND SELECTED VARIANT
  */


  function getSelectedVariant(){


    return currentProduct.variants.find(variant=>{


      return Object.keys(selectedOptions)
      .every((key,index)=>{


        const optionIndex =
          currentProduct.options.find(
            o=>o.name === key
          ).position - 1;



        return (
          variant.options[optionIndex]
          === selectedOptions[key]
        );


      });


    });


  }





  function updatePrice(){


    const variant =
      getSelectedVariant();



    if(variant){

      modalPrice.textContent =
        formatMoney(
          variant.price
        );

    }


  }






  /*
    ADD TO CART
  */


  addButton.addEventListener(
    "click",
    async()=>{


      const variant =
        getSelectedVariant();



      if(!variant){

        alert(
          "Please select options"
        );

        return;

      }




      await addItem(
        variant.id
      );



      /*
        BONUS PRODUCT LOGIC

        Black + Medium
      */


      const hasBlack =
        selectedOptions.Color === "Black";


      const hasMedium =
        selectedOptions.Size === "Medium";



      if(
        hasBlack &&
        hasMedium
      ){

        const bonus =
          window.softWinterJacketVariant;


        if(bonus){

          await addItem(bonus);

        }

      }




      addButton.textContent =
        "ADDED ✓";



      setTimeout(()=>{

        addButton.textContent =
          "ADD TO CART →";

      },1500);



    }
  );








  async function addItem(id){


    return fetch(
      "/cart/add.js",
      {

        method:"POST",

        headers:{
          "Content-Type":
          "application/json"
        },


        body:JSON.stringify({

          items:[
            {
              id:id,
              quantity:1
            }
          ]

        })


      }

    );


  }





  function formatMoney(cents){

    return (
      cents / 100
    ).toFixed(2)
    + "€";

  }



});