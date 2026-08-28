import fondo2 from '@assets/images/Fondo2.png';
import sobreImg from '@assets/images/sobre.jpeg';
import blog1 from '@assets/images/blog1.jpeg';
import blog2 from '@assets/images/blog2.jpeg';
import blog3 from '@assets/images/blog3.jpeg';
import '@styles/info_pages.css';

const InfoSectionsContainer = () => {
  return (
    <>
      <div className="landing-sections-wrapper app-glass">
        {/* SECCIÓN SOBRE NOSOTROS */}
            <div 
          className="login-background-layer" 
          style={{ backgroundImage: `url(${fondo2})` }} 
        />
          <div className="about-layout">
            <div className="about-image-container">
              <img src={sobreImg} alt="Sobre Neodomus" />
            </div>
            <div className="about-text-block">
              <h1>Sobre Nosotros</h1>
              <p>En Neodomus ofrecemos soluciones innovadoras y confiables que generan valor real a nuestros clientes. Nos enfocamos en la calidad, la tecnología y la confianza, brindando servicios eficientes que se adaptan a cada necesidad.</p>
              <p>Nuestra misión es transformar ideas en resultados y nuestra visión, consolidarnos como un aliado estratégico que impulse el crecimiento y la evolución de quienes confían en nosotros.</p>
            </div>
          </div>


        {/* SECCIÓN POR QUÉ CONTRATAR */}
        <section className="info-section">
          <div className="why-title-container">
            <h1>Porque contratar NEODOMUS</h1>
          </div>
          <div className="why-custom-grid">
            <div className="card-gold-base card-gold-style">Confianza y seriedad: trabajamos con transparencia y compromiso en cada proyecto.</div>
            <div className="card-gold-base card-dark-style">Innovación real: ofrecemos soluciones modernas que se adaptan a tus necesidades.</div>
            <div className="card-gold-base card-gold-style">Calidad garantizada: resultados eficientes y duraderos que generan valor.</div>
          </div>
        </section>

        {/* SECCIÓN BLOG */}
        <section className="info-section">
          <div className="blog-title-container">
            <h1>Blog</h1>
          </div>
          <div className="blog-custom-grid">
            <div className="blog-item-box">
              <div className="blog-img-wrapper"><img src={blog1} alt="Blog 1" /></div>
              <div className="blog-text-wrapper"><p>La automatización del hogar ya no es cosa del futuro: en Neodomus hacemos posible que vivas en una casa inteligente hoy mismo.</p></div>
            </div>
            <div className="blog-item-box">
              <div className="blog-img-wrapper"><img src={blog2} alt="Blog 2" /></div>
              <div className="blog-text-wrapper"><p>Confort, seguridad y ahorro de energía en un solo lugar. Así es la experiencia que solo Neodomus puede ofrecerte.</p></div>
            </div>
            <div className="blog-item-box">
              <div className="blog-img-wrapper"><img src={blog3} alt="Blog 3" /></div>
              <div className="blog-text-wrapper"><p>¿Sabías que Neodomus es pionera en llevar la domótica a los hogares de Colombia, convirtiéndose en referente de innovación y tecnología?</p></div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default InfoSectionsContainer;